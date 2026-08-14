/**
 * Paleta validada contra separación por daltonismo, banda de luminosidad y
 * contraste, en modo claro y oscuro. Peor par adyacente: ΔE 7.5 en CVD y 17.0
 * en visión normal.
 *
 * Si vas a cambiar un color, revalidá la paleta completa — un tono lindo
 * suelto puede volver indistinguibles dos categorías. El 7.5 obliga a que los
 * gráficos lleven el nombre de la categoría como etiqueta directa, nunca solo
 * el color. `Otros` es gris a propósito: es el bucket "resto", no compite por
 * identidad.
 */
export const DEFAULT_CATEGORIES = [
  { name: "Supermercado", color: "#0d9488", icon: "ShoppingCart" },
  { name: "Alquiler", color: "#6366f1", icon: "Home" },
  { name: "Servicios", color: "#d97706", icon: "Zap" },
  { name: "Salidas", color: "#ec4899", icon: "UtensilsCrossed" },
  { name: "Transporte", color: "#0284c7", icon: "Car" },
  { name: "Salud", color: "#8b5cf6", icon: "HeartPulse" },
  { name: "Hogar", color: "#ea580c", icon: "Wrench" },
  { name: "Otros", color: "#64748b", icon: "MoreHorizontal" },
] as const;
