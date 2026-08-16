"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Home, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/household-context";
import type { Database, ShoppingListType } from "@/lib/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PrecioDialog } from "@/components/listas/precio-dialog";
import { CerrarCompraForm, type ItemComprado } from "@/components/listas/cerrar-compra-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils/currency";
import { normalizarQuery } from "@/lib/utils/normalizar";
import type { LucideIcon } from "lucide-react";

type ShoppingItem = Database["public"]["Tables"]["shopping_items"]["Row"];

/**
 * El icono se elige acá y no llega por prop: un componente es una función y
 * no se puede serializar desde un Server Component hacia uno cliente.
 */
const ICONOS: Record<ShoppingListType, LucideIcon> = {
  faltantes: Home,
  super: ShoppingCart,
};

export function ShoppingList({
  listType,
  emptyTitle,
  emptyDescription,
  placeholder,
  conPrecios = false,
}: {
  listType: ShoppingListType;
  emptyTitle: string;
  emptyDescription: string;
  placeholder: string;
  /** Solo la lista del súper consulta Coto. */
  conPrecios?: boolean;
}) {
  const icon = ICONOS[listType];

  const supabase = createClient();
  const { householdId, userId } = useHousehold();

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState("");
  // Texto libre a propósito: "2", "1 kg" y "500g" son todos válidos y la
  // columna es text. Forzar un número obligaría a elegir unidad.
  const [cantidad, setCantidad] = useState("");
  const [agregando, setAgregando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [precios, setPrecios] = useState<Record<string, number | null>>({});
  const [precioTarget, setPrecioTarget] = useState<ShoppingItem | null>(null);
  const [cerrarOpen, setCerrarOpen] = useState(false);

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("household_id", householdId)
      .eq("list_type", listType)
      .order("is_checked")
      .order("created_at");

    setLoading(false);

    if (error) {
      toast.error("No pudimos cargar la lista", { description: error.message });
      return;
    }
    setItems((data ?? []) as ShoppingItem[]);
  }, [supabase, householdId, listType]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Realtime: la gracia es que los dos vean lo mismo mientras uno está en el
  // súper. Ante cualquier cambio se refetchea, que para listas de este tamaño
  // es más simple y más seguro que aplicar el delta a mano.
  useEffect(() => {
    const channel = supabase
      .channel(`shopping_items:${householdId}:${listType}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_items",
          filter: `household_id=eq.${householdId}`,
        },
        () => fetchItems(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, householdId, listType, fetchItems]);

  // Precios de los ítems ya vinculados a un producto de Coto. Se piden de a
  // uno por EAN; el route handler cachea, así que repetir es barato.
  useEffect(() => {
    if (!conPrecios) return;

    const pendientes = items.filter(
      (i) => i.coto_ean && !(i.coto_ean in precios),
    );
    if (pendientes.length === 0) return;

    let cancelado = false;

    Promise.all(
      pendientes.map(async (item) => {
        try {
          const res = await fetch(`/api/coto?ean=${encodeURIComponent(item.coto_ean!)}`);
          if (!res.ok) return [item.coto_ean!, null] as const;
          const body = await res.json();
          return [item.coto_ean!, body.productos?.[0]?.price ?? null] as const;
        } catch {
          return [item.coto_ean!, null] as const;
        }
      }),
    ).then((pares) => {
      if (cancelado) return;
      setPrecios((prev) => ({ ...prev, ...Object.fromEntries(pares) }));
    });

    return () => {
      cancelado = true;
    };
  }, [conPrecios, items, precios]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = nuevo.trim();
    if (!name) return;

    setAgregando(true);
    const cant = cantidad.trim();
    setNuevo("");
    setCantidad("");

    // Si ya elegimos alguna vez qué producto es "leche", el ítem nace
    // vinculado y el precio aparece solo.
    let cotoEan: string | null = null;
    if (conPrecios) {
      const { data: link } = await supabase
        .from("coto_links")
        .select("ean")
        .eq("household_id", householdId)
        .eq("query", normalizarQuery(name))
        .maybeSingle();
      cotoEan = link?.ean ?? null;
    }

    const { error } = await supabase.from("shopping_items").insert({
      household_id: householdId,
      list_type: listType,
      name,
      quantity: cant || null,
      coto_ean: cotoEan,
      created_by: userId,
    });

    setAgregando(false);
    inputRef.current?.focus();

    if (error) {
      toast.error("No pudimos agregarlo", { description: error.message });
      setNuevo(name);
      setCantidad(cant);
      return;
    }
    fetchItems();
  }

  async function toggle(item: ShoppingItem) {
    // Optimista: tachar tiene que sentirse instantáneo mientras comprás.
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_checked: !i.is_checked } : i)),
    );

    const { error } = await supabase
      .from("shopping_items")
      .update({ is_checked: !item.is_checked })
      .eq("id", item.id);

    if (error) {
      toast.error("No pudimos actualizarlo", { description: error.message });
      fetchItems();
    }
  }

  async function remove(item: ShoppingItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));

    const { error } = await supabase.from("shopping_items").delete().eq("id", item.id);

    if (error) {
      toast.error("No pudimos borrarlo", { description: error.message });
      fetchItems();
    }
  }

  async function limpiarTachados() {
    const tachados = items.filter((i) => i.is_checked);
    if (tachados.length === 0) return;

    setItems((prev) => prev.filter((i) => !i.is_checked));

    const { error } = await supabase
      .from("shopping_items")
      .delete()
      .in(
        "id",
        tachados.map((i) => i.id),
      );

    if (error) {
      toast.error("No pudimos limpiar la lista", { description: error.message });
      fetchItems();
    }
  }

  const tachados = items.filter((i) => i.is_checked).length;

  const comprados: ItemComprado[] = items
    .filter((i) => i.is_checked)
    .map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      precio: i.coto_ean ? (precios[i.coto_ean] ?? null) : null,
    }));

  // Solo suma lo que tiene precio conocido; los que faltan se cuentan aparte
  // para no dar por bueno un total que en realidad está incompleto.
  const conPrecioConocido = items.filter(
    (i) => i.coto_ean && typeof precios[i.coto_ean] === "number",
  );
  const totalEstimado = conPrecioConocido.length
    ? conPrecioConocido.reduce((sum, i) => sum + precios[i.coto_ean!]!, 0)
    : null;

  // "Todavía no lo buscamos" y "no lo encontramos" son cosas distintas y hasta
  // ahora se contaban juntas: mientras la consulta a Coto estaba en vuelo, un
  // producto vinculado aparecía como "sin vincular" y el cartel se corregía
  // solo unos segundos después.
  const buscando = items.filter(
    (i) => i.coto_ean && precios[i.coto_ean] === undefined,
  ).length;
  const sinVincular = items.filter((i) => !i.coto_ean).length;

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          className="flex-1"
        />
        <Input
          placeholder="Cant."
          aria-label="Cantidad"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="w-20 shrink-0"
        />
        <Button type="submit" size="icon" disabled={agregando || !nuevo.trim()}>
          <Plus className="size-4" />
          <span className="sr-only">Agregar</span>
        </Button>
      </form>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-sm"
              >
                <input
                  type="checkbox"
                  checked={item.is_checked}
                  onChange={() => toggle(item)}
                  aria-label={item.is_checked ? `Desmarcar ${item.name}` : `Marcar ${item.name}`}
                  className="size-4 shrink-0 accent-primary"
                />
                <span
                  className={`min-w-0 flex-1 truncate ${
                    item.is_checked ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  {item.name}
                  {item.quantity && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.quantity}
                    </span>
                  )}
                </span>
                {conPrecios &&
                  (item.coto_ean ? (
                    precios[item.coto_ean] === undefined ? (
                      /* Antes acá iba un "…", que se lee como un menú y no
                         como una espera: durante los segundos que tarda Coto
                         parecía que el producto no tenía precio. */
                      <span
                        role="status"
                        aria-label={`Buscando el precio de ${item.name} en Coto`}
                        className="h-4 w-14 shrink-0 animate-pulse rounded-full bg-muted"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPrecioTarget(item)}
                        className="shrink-0 text-sm tabular-nums text-muted-foreground hover:text-foreground"
                        aria-label={`Cambiar el producto vinculado a ${item.name}`}
                      >
                        {precios[item.coto_ean] === null
                          ? "—"
                          : formatCurrency(precios[item.coto_ean]!)}
                      </button>
                    )
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground"
                      aria-label={`Buscar precio de ${item.name}`}
                      onClick={() => setPrecioTarget(item)}
                    >
                      <Search className="size-3.5" />
                    </Button>
                  ))}

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-danger"
                  aria-label={`Borrar ${item.name}`}
                  onClick={() => remove(item)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {conPrecios && totalEstimado !== null && (
            <div className="flex items-baseline justify-between rounded-xl bg-card px-4 py-3 shadow-sm">
              <span className="text-sm text-muted-foreground">
                Estimado en Coto
                {buscando > 0
                  ? ` · buscando ${buscando} precio${buscando === 1 ? "" : "s"}…`
                  : sinVincular > 0
                    ? ` · ${sinVincular} sin vincular`
                    : ""}
              </span>
              <span className="font-medium tabular-nums">
                {formatCurrency(totalEstimado)}
              </span>
            </div>
          )}

          {conPrecios && tachados > 0 && (
            <Button size="sm" onClick={() => setCerrarOpen(true)}>
              <Check className="size-4" />
              Terminé la compra
            </Button>
          )}

          {tachados > 0 && (
            <Button variant="outline" size="sm" onClick={limpiarTachados}>
              Borrar {tachados} tachado{tachados === 1 ? "" : "s"}
            </Button>
          )}
        </>
      )}

      <Dialog open={cerrarOpen} onOpenChange={setCerrarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar la compra</DialogTitle>
          </DialogHeader>
          <CerrarCompraForm
            items={comprados}
            onSuccess={() => {
              setCerrarOpen(false);
              fetchItems();
            }}
            onCancel={() => setCerrarOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {precioTarget && (
        <PrecioDialog
          itemId={precioTarget.id}
          itemName={precioTarget.name}
          open={!!precioTarget}
          onOpenChange={(open) => !open && setPrecioTarget(null)}
          onVinculado={fetchItems}
        />
      )}
    </div>
  );
}
