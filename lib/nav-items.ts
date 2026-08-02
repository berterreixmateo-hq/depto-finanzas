import { Home, Receipt, CalendarClock, ListChecks, Settings } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/gastos", label: "Gastos", icon: Receipt },
  { href: "/fijos", label: "Fijos", icon: CalendarClock },
  { href: "/listas", label: "Listas", icon: ListChecks },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
] as const;
