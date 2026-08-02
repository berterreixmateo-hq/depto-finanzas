import { Receipt, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { ComingSoonButton } from "@/components/shared/coming-soon-button";

export default function GastosPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Gastos</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por descripción" className="pl-9" disabled />
      </div>

      <EmptyState
        icon={Receipt}
        title="Todavía no cargaste ningún gasto"
        description="Cuando cargues uno, va a aparecer acá agrupado por día."
        action={<ComingSoonButton phase="Fase 2">Cargar gasto</ComingSoonButton>}
      />
    </div>
  );
}
