import { CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ComingSoonButton } from "@/components/shared/coming-soon-button";

export default function FijosPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Fijos</h1>

      <EmptyState
        icon={CalendarClock}
        title="Todavía no definiste gastos fijos"
        description="Alquiler, expensas, luz, internet — se generan solos cada mes."
        action={<ComingSoonButton phase="Fase 4">Agregar gasto fijo</ComingSoonButton>}
      />
    </div>
  );
}
