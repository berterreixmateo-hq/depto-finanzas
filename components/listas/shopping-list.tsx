"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Home, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/household-context";
import type { Database, ShoppingListType } from "@/lib/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PrecioDialog } from "@/components/listas/precio-dialog";
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
  const [agregando, setAgregando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [precios, setPrecios] = useState<Record<string, number | null>>({});
  const [precioTarget, setPrecioTarget] = useState<ShoppingItem | null>(null);

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
    setNuevo("");

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
      coto_ean: cotoEan,
      created_by: userId,
    });

    setAgregando(false);
    inputRef.current?.focus();

    if (error) {
      toast.error("No pudimos agregarlo", { description: error.message });
      setNuevo(name);
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

  // Solo suma lo que tiene precio conocido; los que faltan se cuentan aparte
  // para no dar por bueno un total que en realidad está incompleto.
  const conPrecioConocido = items.filter(
    (i) => i.coto_ean && typeof precios[i.coto_ean] === "number",
  );
  const totalEstimado = conPrecioConocido.length
    ? conPrecioConocido.reduce((sum, i) => sum + precios[i.coto_ean!]!, 0)
    : null;
  const sinPrecio = items.length - conPrecioConocido.length;

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
                    <button
                      type="button"
                      onClick={() => setPrecioTarget(item)}
                      className="shrink-0 text-sm tabular-nums text-muted-foreground hover:text-foreground"
                      aria-label={`Cambiar el producto vinculado a ${item.name}`}
                    >
                      {precios[item.coto_ean] === undefined
                        ? "…"
                        : precios[item.coto_ean] === null
                          ? "—"
                          : formatCurrency(precios[item.coto_ean]!)}
                    </button>
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
                {sinPrecio > 0 && ` · ${sinPrecio} sin vincular`}
              </span>
              <span className="font-medium tabular-nums">
                {formatCurrency(totalEstimado)}
              </span>
            </div>
          )}

          {tachados > 0 && (
            <Button variant="outline" size="sm" onClick={limpiarTachados}>
              Borrar {tachados} tachado{tachados === 1 ? "" : "s"}
            </Button>
          )}
        </>
      )}

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
