import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarProductos, productoPorEan } from "@/lib/coto";

/**
 * Búsqueda de productos en Coto.
 *
 * Corre en el servidor por dos razones: desde el browser CORS lo bloquearía,
 * y acá podemos cachear para no pegarle a Coto una vez por tecla.
 *
 * Pide sesión: no es un dato sensible, pero tampoco hace falta dejar un
 * proxy abierto al catálogo de un tercero colgando de nuestro dominio.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const ean = searchParams.get("ean")?.trim();

  if (!query && !ean) {
    return NextResponse.json({ error: "Falta q o ean" }, { status: 400 });
  }

  try {
    if (ean) {
      const producto = await productoPorEan(ean);
      return NextResponse.json({ productos: producto ? [producto] : [] });
    }
    return NextResponse.json({ productos: await buscarProductos(query!) });
  } catch (error) {
    // Coto puede estar caído o habernos limitado. No es motivo para romper
    // la lista: el precio es un extra, no el contenido.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falló la consulta" },
      { status: 502 },
    );
  }
}
