/**
 * Clave de búsqueda para los vínculos aprendidos de Coto.
 *
 * "Leche  La Serenísima" y "leche la serenisima" tienen que resolver al mismo
 * vínculo, así que se saca mayúsculas, acentos y espacios de más.
 */
export function normalizarQuery(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
