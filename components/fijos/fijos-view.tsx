"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  StickyNote,
  Trash2,
} from "lucide-react";
import {
  addMonths,
  endOfMonth,
  format,
  isAfter,
  startOfMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/household-context";
import { onExpensesChanged } from "@/lib/expenses-bus";
import type {
  RecurringExpense,
  RecurringInstance,
  ServicioDelMes,
} from "@/lib/types/recurring";
import { formatCurrency } from "@/lib/utils/currency";
import { cuotaLabel, FREQUENCY_LABELS, ocurrenciaEnMes } from "@/lib/utils/recurrence";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { RecurringForm } from "@/components/fijos/recurring-form";
import { PayForm } from "@/components/fijos/pay-form";

type RecurringWithCategory = RecurringExpense & {
  categories: ServicioDelMes["categories"];
};

/** El día 31 en un mes de 30 se vence el último día, no se saltea. */
function dueDateFor(monthDate: Date, dayOfMonth: number): string {
  const lastDay = endOfMonth(monthDate).getDate();
  const day = Math.min(dayOfMonth, lastDay);
  return format(
    new Date(monthDate.getFullYear(), monthDate.getMonth(), day),
    "yyyy-MM-dd",
  );
}

export function FijosView() {
  const supabase = createClient();
  const { householdId, categories } = useHousehold();

  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [servicios, setServicios] = useState<ServicioDelMes[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RecurringExpense | null>(null);
  const [payTarget, setPayTarget] = useState<ServicioDelMes | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServicioDelMes | null>(null);

  const monthKey = format(monthDate, "yyyy-MM-01");

  const fetchServicios = useCallback(async () => {
    setLoading(true);

    const { data: definiciones, error: defError } = await supabase
      .from("recurring_expenses")
      .select("*, categories(name, color, icon)")
      .eq("household_id", householdId)
      .eq("active", true)
      .order("day_of_month");

    if (defError) {
      setLoading(false);
      toast.error("No pudimos cargar los servicios", { description: defError.message });
      return;
    }

    // Un bimestral no cae todos los meses, y una serie de cuotas se termina.
    // Lo que no corresponde a este mes no se lista ni genera cuota.
    const lista = ((definiciones ?? []) as RecurringWithCategory[]).filter(
      (servicio) => ocurrenciaEnMes(servicio, monthDate).aplica,
    );

    if (lista.length === 0) {
      setServicios([]);
      setLoading(false);
      return;
    }

    const { data: instancias, error: instError } = await supabase
      .from("recurring_expense_instances")
      .select("*")
      .eq("household_id", householdId)
      .eq("month", monthKey);

    if (instError) {
      setLoading(false);
      toast.error("No pudimos cargar las cuotas del mes", {
        description: instError.message,
      });
      return;
    }

    let porDefinicion = new Map<string, RecurringInstance>(
      ((instancias ?? []) as RecurringInstance[]).map((i) => [i.recurring_expense_id, i]),
    );

    // Generación perezosa, según la decisión ya tomada para este proyecto: las
    // cuotas del mes se crean al abrir la pestaña, sin cron ni Edge Function.
    // No se generan meses futuros: navegar hacia adelante no debe ensuciar la
    // base con cuotas de un mes que todavía no llegó.
    const esFuturo = isAfter(monthDate, startOfMonth(new Date()));
    const faltantes = esFuturo
      ? []
      : lista.filter((servicio) => !porDefinicion.has(servicio.id));

    if (faltantes.length > 0) {
      const { data: creadas, error: createError } = await supabase
        .from("recurring_expense_instances")
        .insert(
          faltantes.map((servicio) => ({
            recurring_expense_id: servicio.id,
            household_id: householdId,
            month: monthKey,
            due_date: dueDateFor(monthDate, servicio.day_of_month),
            estimated_amount: servicio.estimated_amount,
          })),
        )
        .select("*");

      if (createError) {
        toast.error("No pudimos generar las cuotas del mes", {
          description: createError.message,
        });
      } else {
        porDefinicion = new Map(porDefinicion);
        for (const instancia of (creadas ?? []) as RecurringInstance[]) {
          porDefinicion.set(instancia.recurring_expense_id, instancia);
        }
      }
    }

    setServicios(
      lista.map((servicio) => ({
        ...servicio,
        instance: porDefinicion.get(servicio.id) ?? null,
      })),
    );
    setLoading(false);
  }, [supabase, householdId, monthDate, monthKey]);

  useEffect(() => {
    fetchServicios();
  }, [fetchServicios]);

  useEffect(() => onExpensesChanged(fetchServicios), [fetchServicios]);

  async function handleDelete() {
    if (!deleteTarget) return;

    // `active: false` en vez de delete: las instancias ya pagadas cuelgan de
    // esta fila con on delete cascade, y borrarla se llevaría el historial.
    const { error } = await supabase
      .from("recurring_expenses")
      .update({ active: false })
      .eq("id", deleteTarget.id);

    setDeleteTarget(null);

    if (error) {
      toast.error("No pudimos borrar el servicio", { description: error.message });
      return;
    }
    toast.success("Servicio borrado");
    fetchServicios();
  }

  const total = servicios.reduce(
    (sum, servicio) => sum + Number(servicio.estimated_amount),
    0,
  );
  const pendientes = servicios.filter((s) => s.instance?.status !== "paid");

  // Agrupado por categoría con subtotal, para poder leer de un vistazo cuánto
  // se va en servicios contra cuánto en, por ejemplo, suscripciones.
  const porCategoria = categories
    .map((category) => {
      const delGrupo = servicios.filter((s) => s.category_id === category.id);
      return {
        ...category,
        servicios: delGrupo,
        total: delGrupo.reduce((sum, s) => sum + Number(s.estimated_amount), 0),
      };
    })
    .filter((grupo) => grupo.servicios.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Fijos</h1>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          Agregar servicio
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMonthDate((d) => addMonths(d, -1))}
          aria-label="Mes anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm font-medium capitalize">
          {format(monthDate, "MMMM yyyy", { locale: es })}
        </p>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMonthDate((d) => addMonths(d, 1))}
          aria-label="Mes siguiente"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : servicios.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Todavía no definiste gastos fijos"
          description="Alquiler, expensas, luz, internet — se generan solos cada mes."
          action={<Button onClick={() => setAddOpen(true)}>Agregar servicio</Button>}
        />
      ) : (
        <>
          <div className="flex items-baseline justify-between rounded-2xl bg-card p-4 shadow-sm">
            <span className="text-sm text-muted-foreground">
              {pendientes.length === 0
                ? "Todo pagado este mes"
                : `${pendientes.length} sin pagar`}
            </span>
            <span className="font-medium tabular-nums">{formatCurrency(total)}</span>
          </div>

          <div className="flex flex-col gap-4">
            {porCategoria.map((grupo) => (
              <div key={grupo.id} className="overflow-hidden rounded-2xl bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: grupo.color }}
                    />
                    {grupo.name}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatCurrency(grupo.total)}
                  </span>
                </div>

                <div className="divide-y divide-border/50">
                  {grupo.servicios.map((servicio) => {
                    const pagado = servicio.instance?.status === "paid";
                    return (
                      <div
                        key={servicio.id}
                        className={`flex items-center gap-2 px-4 py-3 ${pagado ? "opacity-50" : ""}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate font-medium">
                            {servicio.name}
                            {servicio.notes && (
                              <span
                                title={servicio.notes}
                                aria-label={`Notas: ${servicio.notes}`}
                                className="text-muted-foreground"
                              >
                                <StickyNote className="size-3.5" />
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {cuotaLabel(ocurrenciaEnMes(servicio, monthDate)) ??
                              (servicio.frequency === "mensual"
                                ? `Vence el ${servicio.day_of_month}`
                                : `${FREQUENCY_LABELS[servicio.frequency]} · vence el ${servicio.day_of_month}`)}{" "}
                            · {formatCurrency(servicio.estimated_amount)}
                            {pagado && " · pagado"}
                          </p>
                        </div>

                        {servicio.payment_url && (
                          <a
                            href={servicio.payment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Ir a pagar ${servicio.name}`}
                            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}

                        {pagado ? (
                          <span
                            className="flex size-8 shrink-0 items-center justify-center text-success"
                            aria-label="Pagado"
                          >
                            <Check className="size-4" />
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => setPayTarget(servicio)}
                            disabled={!servicio.instance}
                          >
                            Pagar
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground"
                          aria-label={`Editar ${servicio.name}`}
                          onClick={() => setEditTarget(servicio)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground hover:text-danger"
                          aria-label={`Borrar ${servicio.name}`}
                          onClick={() => setDeleteTarget(servicio)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar servicio</DialogTitle>
          </DialogHeader>
          <RecurringForm
            onSuccess={() => {
              setAddOpen(false);
              fetchServicios();
            }}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar servicio</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <RecurringForm
              servicio={editTarget}
              onSuccess={() => {
                setEditTarget(null);
                fetchServicios();
              }}
              onCancel={() => setEditTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!payTarget} onOpenChange={(open) => !open && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar {payTarget?.name}</DialogTitle>
          </DialogHeader>
          {payTarget && (
            <PayForm
              servicio={payTarget}
              onSuccess={() => {
                setPayTarget(null);
                fetchServicios();
              }}
              onCancel={() => setPayTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de aparecer en Fijos y no se genera más cada mes. Los gastos que ya
              cargaste por este servicio quedan donde están.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
