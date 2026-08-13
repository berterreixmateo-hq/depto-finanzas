"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/household-context";
import type { CotoProduct } from "@/lib/coto";
import { formatCurrency } from "@/lib/utils/currency";
import { normalizarQuery } from "@/lib/utils/normalizar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Elegir a qué producto de Coto corresponde un ítem de la lista.
 *
 * La elección se guarda en el ítem y también en `coto_links`, para que la
 * próxima vez que alguien escriba lo mismo ya venga resuelto.
 */
export function PrecioDialog({
  itemId,
  itemName,
  open,
  onOpenChange,
  onVinculado,
}: {
  itemId: string;
  itemName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVinculado: () => void;
}) {
  const supabase = createClient();
  const { householdId } = useHousehold();

  const [productos, setProductos] = useState<CotoProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelado = false;
    setLoading(true);
    setError(null);

    fetch(`/api/coto?q=${encodeURIComponent(itemName)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Falló la búsqueda");
        return body.productos as CotoProduct[];
      })
      .then((data) => {
        if (cancelado) return;
        setProductos(data);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (cancelado) return;
        setError(e.message);
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [open, itemName]);

  async function elegir(producto: CotoProduct) {
    const [itemRes, linkRes] = await Promise.all([
      supabase.from("shopping_items").update({ coto_ean: producto.ean }).eq("id", itemId),
      supabase.from("coto_links").upsert({
        household_id: householdId,
        query: normalizarQuery(itemName),
        ean: producto.ean,
        product_name: producto.name,
        updated_at: new Date().toISOString(),
      }),
    ]);

    if (itemRes.error) {
      toast.error("No pudimos vincular el producto", {
        description: itemRes.error.message,
      });
      return;
    }
    // El vínculo aprendido es una optimización: si falla, el ítem igual quedó
    // vinculado y no vale la pena molestar con un error.
    if (linkRes.error) {
      console.warn("No se guardó el vínculo aprendido:", linkRes.error.message);
    }

    onVinculado();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Precio de &ldquo;{itemName}&rdquo;</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : error ? (
          <p className="py-4 text-sm text-danger">
            No pudimos consultar Coto: {error}
          </p>
        ) : productos.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Coto no devolvió resultados para &ldquo;{itemName}&rdquo;. Probá con otro
            nombre desde la lista.
          </p>
        ) : (
          <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
            {productos.map((producto) => (
              <button
                key={producto.ean}
                type="button"
                onClick={() => elegir(producto)}
                className="flex items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-muted"
              >
                {producto.imageUrl && (
                  // Imagen del CDN de Coto. Va como <img> y no <Image>: pasarla
                  // por el optimizador de Next obligaría a declarar su host y
                  // nos cobraría ancho de banda por miniaturas de terceros.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={producto.imageUrl}
                    alt=""
                    className="size-10 shrink-0 rounded-lg bg-white object-contain"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{producto.name}</span>
                  {producto.brand && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {producto.brand}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {producto.price === null ? "—" : formatCurrency(producto.price)}
                </span>
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Precios de la sucursal Vicente López. Varían bastante entre sucursales.
        </p>
      </DialogContent>
    </Dialog>
  );
}
