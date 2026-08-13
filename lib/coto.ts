import "server-only";

/**
 * Consultas al catálogo de Coto.
 *
 * El sitio de Coto es una SPA de Angular y la búsqueda la resuelve
 * Constructor.io, un buscador hosteado. La key es la del cliente web, que
 * viaja en el bundle público del sitio — no es un secreto nuestro ni de
 * ellos, pero por las dudas todo esto corre solo en el servidor: desde el
 * browser CORS lo bloquearía igual.
 */

const CONSTRUCTOR_KEY = "key_r6xzz4IAoTWcipni";
const ENDPOINT = "https://ac.cnstrc.com/search";

/**
 * Sucursal 092 — Vicente López, Av. Maipú 1758.
 *
 * Importa y mucho: el mismo producto puede costar $1.389 en una sucursal y
 * $2.399 en otra. Si algún día se mudan, esto es lo único que hay que
 * cambiar. El listado completo está en coto.com.ar/sucursales/index.asp.
 */
export const COTO_STORE = "092";

export interface CotoProduct {
  ean: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  /** Precio en la sucursal configurada, o null si no la abastece. */
  price: number | null;
}

interface ConstructorResult {
  data: {
    product_main_ean?: string;
    sku_display_name?: string;
    product_brand?: string;
    medium_image_url?: string;
    product_medium_image_url?: string;
    price?: { store: string; listPrice: number }[];
  };
}

function toProduct(result: ConstructorResult): CotoProduct | null {
  const d = result.data;
  if (!d.product_main_ean || !d.sku_display_name) return null;

  const enSucursal = d.price?.find((p) => p.store === COTO_STORE);

  return {
    ean: String(d.product_main_ean),
    name: d.sku_display_name,
    brand: d.product_brand ?? null,
    imageUrl: d.product_medium_image_url ?? d.medium_image_url ?? null,
    price: enSucursal ? enSucursal.listPrice : null,
  };
}

async function buscar(query: string, limit: number): Promise<CotoProduct[]> {
  const url = new URL(`${ENDPOINT}/${encodeURIComponent(query)}`);
  url.searchParams.set("key", CONSTRUCTOR_KEY);
  // Constructor exige un client id y una sesión; no identifican a nadie.
  url.searchParams.set("i", "00000000-0000-4000-8000-000000000000");
  url.searchParams.set("s", "1");
  url.searchParams.set("c", "ciojs-client-2.60.0");
  url.searchParams.set("num_results_per_page", String(limit));

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    // El catálogo no cambia de precio cada minuto y no queremos pegarle a
    // Coto una vez por tecla.
    next: { revalidate: 60 * 60 },
  });

  if (!res.ok) {
    throw new Error(`Coto respondió ${res.status}`);
  }

  const json = (await res.json()) as {
    response?: { results?: ConstructorResult[] };
  };

  return (json.response?.results ?? [])
    .map(toProduct)
    .filter((p): p is CotoProduct => p !== null);
}

/** Candidatos para que una persona elija cuál es "leche". */
export function buscarProductos(query: string): Promise<CotoProduct[]> {
  return buscar(query, 8);
}

/** Un EAN devuelve exactamente un producto, así que no hay ambigüedad. */
export async function productoPorEan(ean: string): Promise<CotoProduct | null> {
  const resultados = await buscar(ean, 1);
  return resultados.find((p) => p.ean === ean) ?? resultados[0] ?? null;
}
