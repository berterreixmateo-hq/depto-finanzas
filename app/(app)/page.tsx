import { PiggyBank, PieChart, BarChart3, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ComingSoonButton } from "@/components/shared/coming-soon-button";
import { formatCurrency } from "@/lib/utils/currency";

const MES_ACTUAL = new Date().toLocaleDateString("es-AR", {
  month: "long",
  year: "numeric",
});

export default function InicioPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground capitalize">{MES_ACTUAL}</p>
        <p className="text-5xl font-semibold tabular-nums tracking-tight">
          {formatCurrency(0)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Todavía no hay gastos este mes
        </p>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm text-muted-foreground">Entre ustedes</p>
            <p className="text-lg font-medium">Están al día</p>
          </div>
          <PiggyBank className="size-6 text-muted-foreground" />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <EmptyState
          icon={PieChart}
          title="Gastos por categoría"
          description="Aparece en cuanto cargues tu primer gasto del mes."
        />
        <EmptyState
          icon={BarChart3}
          title="Últimos 6 meses"
          description="El comparativo mensual se arma con el tiempo."
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">Gastos recientes</p>
        <EmptyState
          icon={Receipt}
          title="Todavía no cargaste gastos"
          description="Arrancá con el primero: monto, categoría y listo."
          action={<ComingSoonButton phase="Fase 2">Cargar primer gasto</ComingSoonButton>}
        />
      </div>
    </div>
  );
}
