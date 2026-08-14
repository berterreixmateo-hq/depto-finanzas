import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

export const BUCKET_FACTURAS = "facturas";

export const TIPOS_FACTURA = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const MAX_FACTURA_BYTES = 10 * 1024 * 1024;

/**
 * La ruta empieza con el household_id porque es lo que la política de Storage
 * mira para decidir el acceso. Ver `supabase/migrations/0010_facturas.sql`.
 */
export function rutaFactura(
  householdId: string,
  instanceId: string,
  fileName: string,
): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "bin";
  return `${householdId}/${instanceId}.${ext}`;
}

export function esTipoFacturaValido(tipo: string): boolean {
  return (TIPOS_FACTURA as readonly string[]).includes(tipo);
}

/**
 * URL temporal para ver una factura. El bucket es privado, así que no hay URL
 * pública: se firma cada vez y vence.
 */
export async function urlFirmada(
  supabase: SupabaseClient<Database>,
  ruta: string,
  segundos = 60,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_FACTURAS)
    .createSignedUrl(ruta, segundos);
  return error ? null : (data?.signedUrl ?? null);
}
