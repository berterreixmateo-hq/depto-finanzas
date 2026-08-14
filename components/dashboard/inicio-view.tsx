"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  PiggyBank,
  Receipt,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/household-context";
import { onExpensesChanged, notifyExpensesChanged } from "@/lib/expenses-bus";
import { computeBalance } from "@/lib/utils/split";
import { formatCurrency } from "@/lib/utils/currency";
import type { ExpenseWithCategory } from "@/lib/types/expense";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ExpenseDialog } from "@/components/expenses/expense-dialog";
import { MonthSummary } from "@/components/dashboard/month-summary";
import { TrendChart } from "@/components/dashboard/trend-chart";
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

const MES_ACTUAL = format(new Date(), "MMMM yyyy", { locale: es });

type BalanceExpense = {
  amount: number;
  expense_date: string;
  paid_by: string;
  payer_share_percentage: number;
};
type Settlement = { amount: number; settled_by: string };

export function InicioView() {
  const supabase = createClient();
  const { householdId, userId, partnerId, partnerName } = useHousehold();

  const [loading, setLoading] = useState(true);
  const [totalMes, setTotalMes] = useState(0);
  const [totalMesAnterior, setTotalMesAnterior] = useState(0);
  const [balance, setBalance] = useState(0);
  const [recent, setRecent] = useState<ExpenseWithCategory[]>([]);
  const [confirmSettle, setConfirmSettle] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    const now = new Date();
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
    const prevStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
    const prevEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");

    const [allExpenses, settlements, recentExpenses] = await Promise.all([
      supabase
        .from("expenses")
        .select("amount, expense_date, paid_by, payer_share_percentage")
        .eq("household_id", householdId),
      supabase
        .from("settlements")
        .select("amount, settled_by")
        .eq("household_id", householdId),
      supabase
        .from("expenses")
        .select("*, categories(name, color, icon)")
        .eq("household_id", householdId)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    setLoading(false);

    if (allExpenses.error || settlements.error || recentExpenses.error) {
      toast.error("No pudimos cargar el resumen de Inicio");
      return;
    }

    const expenses = (allExpenses.data ?? []) as BalanceExpense[];

    const sumInRange = (from: string, to: string) =>
      expenses
        .filter((e) => e.expense_date >= from && e.expense_date <= to)
        .reduce((acc, e) => acc + e.amount, 0);

    setTotalMes(sumInRange(monthStart, monthEnd));
    setTotalMesAnterior(sumInRange(prevStart, prevEnd));

    if (partnerId) {
      setBalance(
        computeBalance(
          expenses,
          (settlements.data ?? []) as Settlement[],
          userId,
          partnerId,
        ),
      );
    }

    setRecent((recentExpenses.data ?? []) as ExpenseWithCategory[]);
  }, [supabase, householdId, userId, partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => onExpensesChanged(load), [load]);

  async function handleSettle() {
    setConfirmSettle(false);
    if (!partnerId || balance === 0) return;

    const settledBy = balance > 0 ? userId : partnerId;

    const { error } = await supabase.from("settlements").insert({
      household_id: householdId,
      amount: Math.abs(balance),
      settled_by: settledBy,
    });

    if (error) {
      toast.error("No pudimos registrar el saldo", { description: error.message });
      return;
    }

    toast.success("Saldo registrado");
    notifyExpensesChanged();
  }

  const change =
    totalMesAnterior > 0
      ? Math.round(((totalMes - totalMesAnterior) / totalMesAnterior) * 100)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground capitalize">{MES_ACTUAL}</p>
        {loading ? (
          <Skeleton className="h-12 w-48" />
        ) : (
          <p className="text-5xl font-semibold tabular-nums tracking-tight">
            {formatCurrency(totalMes)}
          </p>
        )}
        {!loading && (
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            {change === null ? (
              "Sin datos del mes anterior"
            ) : (
              <>
                {change >= 0 ? (
                  <ArrowUp className="size-3.5" />
                ) : (
                  <ArrowDown className="size-3.5" />
                )}
                {Math.abs(change)}% vs mes anterior
              </>
            )}
          </p>
        )}
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="flex items-center justify-between py-5">
          {loading ? (
            <Skeleton className="h-6 w-40" />
          ) : !partnerId ? (
            <div>
              <p className="text-sm text-muted-foreground">Entre ustedes</p>
              <p className="text-lg font-medium">Esperando a que se una tu pareja</p>
            </div>
          ) : balance === 0 ? (
            <div>
              <p className="text-sm text-muted-foreground">Entre ustedes</p>
              <p className="text-lg font-medium">Están al día</p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground">Entre ustedes</p>
              <p
                className={`text-lg font-medium ${balance > 0 ? "text-danger" : "text-success"}`}
              >
                {balance > 0
                  ? `Le debés ${formatCurrency(balance)} a ${partnerName}`
                  : `${partnerName} te debe ${formatCurrency(Math.abs(balance))}`}
              </p>
            </div>
          )}
          {!loading && partnerId && balance !== 0 ? (
            <Button variant="outline" size="sm" onClick={() => setConfirmSettle(true)}>
              Saldar
            </Button>
          ) : (
            <PiggyBank className="size-6 text-muted-foreground" />
          )}
        </CardContent>
      </Card>

      <MonthSummary />

      <TrendChart />

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">Gastos recientes</p>
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Todavía no cargaste gastos"
            description="Arrancá con el primero: monto, categoría y listo."
            action={<Button onClick={() => setAddOpen(true)}>Cargar primer gasto</Button>}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: expense.categories?.color ?? "#64748b" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{expense.description}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {expense.categories?.name}
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatCurrency(expense.amount)}
                </span>
              </div>
            ))}
            <Link
              href="/gastos"
              className="self-start text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
            >
              Ver todos
            </Link>
          </div>
        )}
      </div>

      <ExpenseDialog open={addOpen} onOpenChange={setAddOpen} />

      <AlertDialog open={confirmSettle} onOpenChange={setConfirmSettle}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmás que se saldó?</AlertDialogTitle>
            <AlertDialogDescription>
              Se va a registrar un pago de {formatCurrency(Math.abs(balance))} y el balance
              entre ustedes vuelve a cero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSettle}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
