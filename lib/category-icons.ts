import {
  Baby,
  Book,
  Bus,
  Car,
  Cat,
  Dumbbell,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  MoreHorizontal,
  PawPrint,
  Plane,
  Popcorn,
  Scissors,
  Shirt,
  ShoppingCart,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Íconos disponibles para categorías. Es un mapa explícito y no un import
 * dinámico de lucide: así el bundle solo carga estos y no las dos mil y pico
 * de la librería.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  ShoppingCart,
  Home,
  Zap,
  UtensilsCrossed,
  Car,
  HeartPulse,
  Wrench,
  MoreHorizontal,
  Bus,
  Plane,
  Popcorn,
  Shirt,
  Scissors,
  Dumbbell,
  Book,
  GraduationCap,
  Laptop,
  Smartphone,
  Gift,
  Baby,
  Cat,
  PawPrint,
  Sparkles,
};

export function iconoDeCategoria(nombre: string): LucideIcon {
  return CATEGORY_ICONS[nombre] ?? MoreHorizontal;
}

/**
 * Paleta validada contra daltonismo, banda de luminosidad y contraste en modo
 * claro y oscuro. Ver `lib/default-categories.ts`.
 *
 * Es un conjunto cerrado a propósito: un color elegido a ojo puede volver dos
 * categorías indistinguibles en un gráfico, y eso no se nota hasta que alguien
 * intenta leerlo. Si hiciera falta un noveno color, no se inventa uno — hay que
 * revalidar la paleta completa con el validador de la skill `dataviz`.
 */
export const CATEGORY_COLORS = [
  { hex: "#0d9488", nombre: "Verde azulado" },
  { hex: "#6366f1", nombre: "Índigo" },
  { hex: "#d97706", nombre: "Ámbar" },
  { hex: "#ec4899", nombre: "Rosa" },
  { hex: "#0284c7", nombre: "Azul" },
  { hex: "#8b5cf6", nombre: "Violeta" },
  { hex: "#ea580c", nombre: "Naranja" },
  { hex: "#64748b", nombre: "Gris" },
] as const;
