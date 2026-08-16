"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Pencil, Receipt, Search, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/household-context";
import { onExpensesChanged, notifyExpensesChanged } from "@/lib/expenses-bus";
import type { ExpenseWithCategory } from "@/lib/types/expense";
import { formatCurrency } from "@/lib/utils/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ExpenseDialog } from "@/components/expenses/expense-dialog";
import { TicketForm } from "@/components/expenses/ticket-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function dayLabel(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  if (isToday(date)) return "Hoy";
  if (isYesterday(date)) return "Ayer";
  return format(date, "EEEE d 'de' MMMM", { locale: es });
}

function splitLabel(expense: ExpenseWithCategory, userId: string, partnerName: string | null) {
  if (expense.settled_on_payment) return "Pagaron los dos · sin deuda";

  const payerIsMe = expense.paid_by === userId;
  const payer = payerIsMe ? "Vos" : partnerName ?? "Tu pareja";
  if (expense.split_type === "only_payer") return `Pagó ${payer} · solo suyo`;
  if (expense.split_type === "50_50") return `Pagó ${payer} · 50/50`;
  return `Pagó ${payer} · ${expense.payer_share_percentage}%`;
}

export function ExpensesView() {
  const supabase = createClient();
  const { householdId, userId, partnerName, categories } = useHousehold();

  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExpenseWithCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseWithCategory | null>(null);
  // Fecha del último "Saldar". Un gasto anterior a ese momento ya entró en un
  // balance que se dio por cerrado: borrarlo lo mueve para atrás.
  const [ultimoSaldo, setUltimoSaldo] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("expenses")
      .select("*, categories(name, color, icon)")
      .eq("household_id", householdId)
      .gte("expense_date", format(startOfMonth(monthDate), "yyyy-MM-dd"))
      .lte("expense_date", format(endOfMonth(monthDate), "yyyy-MM-dd"))
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (categoryFilter !== "all") {
      query = query.eq("category_id", categoryFilter);
    }
    if (debouncedSearch.trim()) {
      query = query.ilike("description", `%${debouncedSearch.trim()}%`);
    }

    const { data, error } = await query;
    setLoading(false);

    if (error) {
      toast.error("No pudimos cargar los gastos", { description: error.message });
      return;
    }
    setExpenses((data ?? []) as ExpenseWithCategory[]);
  }, [supabase, householdId, monthDate, categoryFilter, debouncedSearch]);

  const fetchUltimoSaldo = useCallback(async () => {
    const { data } = await supabase
      .from("settlements")
      .select("created_at")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(1);
    setUltimoSaldo(data?.[0]?.created_at ?? null);
  }, [supabase, householdId]);

  useEffect(() => {
    fetchUltimoSaldo();
  }, [fetchUltimoSaldo]);

  useEffect(() => onExpensesChanged(fetchUltimoSaldo), [fetchUltimoSaldo]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => onExpensesChanged(fetchExpenses), [fetchExpenses]);

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from("expenses").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    if (error) {
      toast.error("No pudimos borrar el gasto", { description: error.message });
      return;
    }
    toast.success("Gasto borrado");
    notifyExpensesChanged();
  }

  // Sin `items` en el Root, <SelectValue> de Base UI muestra el valor crudo ("all").
  const categoryFilterItems = [
    { value: "all", label: "Todas las categorías" },
    ...categories.map((category) => ({ value: category.id, label: category.name })),
  ];

  // El gasto ya estaba contado cuando se registró el último "Saldar", así que
  // borrarlo cambia un balance que los dos dieron por cerrado.
  const yaSaldado =
    !!deleteTarget && !!ultimoSaldo && deleteTarget.created_at < ultimoSaldo;

  const groups = new Map<string, ExpenseWithCategory[]>();
  for (const expense of expenses) {
    const list = groups.get(expense.expense_date) ?? [];
    list.push(expense);
    groups.set(expense.expense_date, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Gastos</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setTicketOpen(true)}>
            <Camera className="size-3.5" />
            Ticket
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            Cargar gasto
          </Button>
        </div>
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

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descripción"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          items={categoryFilterItems}
          value={categoryFilter}
          onValueChange={(value) => value && setCategoryFilter(value)}
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No hay gastos acá"
          description="Probá otro mes o filtro, o cargá el primero."
          action={<Button onClick={() => setAddOpen(true)}>Cargar gasto</Button>}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {[...groups.entries()].map(([date, dayExpenses]) => (
            <div key={date} className="flex flex-col gap-2">
              <p className="text-sm font-medium capitalize text-muted-foreground">
                {dayLabel(date)}
              </p>
              <div className="flex flex-col gap-2">
                {dayExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => setEditTarget(expense)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: expense.categories?.color ?? "#64748b" }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {expense.description}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {expense.categories?.name} · {splitLabel(expense, userId, partnerName)}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatCurrency(expense.amount)}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground"
                      aria-label="Editar"
                      onClick={() => setEditTarget(expense)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-danger"
                      aria-label="Borrar"
                      onClick={() => setDeleteTarget(expense)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cargar desde un ticket</DialogTitle>
          </DialogHeader>
          <TicketForm
            onSuccess={() => setTicketOpen(false)}
            onCancel={() => setTicketOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ExpenseDialog open={addOpen} onOpenChange={setAddOpen} />
      <ExpenseDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        expense={editTarget ?? undefined}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.description} · {deleteTarget ? formatCurrency(deleteTarget.amount) : ""}
              . Esta acción no se puede deshacer.
            </AlertDialogDescription>
            {yaSaldado && (
              <p className="rounded-xl bg-warning/10 p-3 text-sm text-warning-foreground">
                Ojo: este gasto ya estaba contado cuando saldaron el{" "}
                {format(new Date(ultimoSaldo!), "d 'de' MMMM", { locale: es })}. Si lo
                borrás, el balance entre ustedes se va a mover aunque ese saldo ya esté
                pago. Revisá el historial de saldos en Inicio.
              </p>
            )}
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
