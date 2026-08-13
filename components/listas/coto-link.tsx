import { ExternalLink, ShoppingCart } from "lucide-react";

/**
 * Acceso directo a la tienda online donde hacen las compras.
 *
 * No se usa el logo de Coto: es una marca registrada y no tenemos el archivo
 * ni permiso para distribuirlo. Si querés el logo real, poné el .svg en
 * `public/` y se reemplaza el ícono por un <Image>.
 */
export function CotoLink() {
  return (
    <a
      href="https://www.coto.com.ar/"
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm transition-colors hover:bg-muted"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E4022D] text-white">
        <ShoppingCart className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Comprar en Coto Digital</span>
        <span className="block text-xs text-muted-foreground">
          Abre la tienda online en otra pestaña
        </span>
      </span>
      <ExternalLink className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
    </a>
  );
}
