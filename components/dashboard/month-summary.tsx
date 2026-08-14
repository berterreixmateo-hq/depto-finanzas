"use client";

import { useCallback, useEffect, useState } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/household-context";
import { onExpensesChanged } from "@/lib/expenses-bus";
import { shareOf } from "@/lib/utils/split";
import { formatCurrency } from "@/lib/utils/currency";
import { vigentesPorClave } from "@/lib/utils/vigencia";
import { Skeleton } from "@/components/ui/skeleton";

interface GastoDelMes {
  amount: number;
  category_id: string;
  paid_by: string;
  payer_share_percentage: number;
}

interface Fila {
  categoryId: string;
  name: string;
  color: string;
  total: number;
  budget: number | null;
}

/**
 * Barra de progreso contra un tope. El relleno lleva **solo** la severidad:
 * neutro mientras alcanza, ámbar al 80%, rojo al pasarse.
 *
 * No lleva el color de la categoría, aunque sea tentador: Servicios es ámbar y
 * su barra al 65% se veía igual que una en alerta al 89%. Cuando el relleno
 * compite entre identidad y estado, gana la identidad y el aviso deja de
 * avisar. La identidad la carga el puntito al lado del nombre.
 */
function Medidor({ fila }: { fila: Fila }) {
  const tope = fila.budget ?? 0;
  const ratio = tope > 0 ? fila.total / tope : 0;
  const pct = Math.min(ratio, 1) * 100;

  const color =
    ratio >= 1
      ? "var(--color-danger)"
      : ratio >= 0.8
        ? "var(--color-warning)"
        : "var(--color-primary)";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: fila.color }}
          />
          <span className="truncate">{fila.name}</span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatCurrency(fila.total)} de {formatCurrency(tope)}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        // Pista neutra: el color aparece solo cuando hay algo que mirar.
        style={{ backgroundColor: "var(--color-muted)" }}
        role="progressbar"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${fila.name}: ${Math.round(ratio * 100)}% del presupuesto`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {ratio >= 1 && (
        <p className="text-xs text-danger">
          Te pasaste por {formatCurrency(fila.total - tope)}.
        </p>
      )}
    </div>
  );
}

export function MonthSummary() {
  const supabase = createClient();
  const { householdId, userId, partnerId, partnerName, categories } = useHousehold();

  const [loading, setLoading] = useState(true);
  const [gastos, setGastos] = useState<GastoDelMes[]>([]);
  const [presupuestos, setPresupuestos] = useState<Map<string, number>>(new Map());
  const [ingresos, setIngresos] = useState<Map<string, number>>(new Map());

  const monthKey = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const load = useCallback(async () => {
    const [gastosRes, budgetsRes, incomesRes] = await Promise.all([
      supabase
        .from("expenses")
        .select("amount, category_id, paid_by, payer_share_percentage")
        .eq("household_id", householdId)
        .gte("expense_date", monthKey)
        .lte("expense_date", monthEnd),
      supabase
        .from("budgets")
        .select("category_id, effective_month, amount")
        .eq("household_id", householdId)
        .lte("effective_month", monthKey),
      supabase
        .from("incomes")
        .select("user_id, effective_month, amount")
        .eq("household_id", householdId)
        .lte("effective_month", monthKey),
    ]);

    setLoading(false);

    if (gastosRes.error || budgetsRes.error || incomesRes.error) {
      toast.error("No pudimos cargar el resumen del mes");
      return;
    }

    setGastos((gastosRes.data ?? []) as GastoDelMes[]);

    const b = vigentesPorClave(
      (budgetsRes.data ?? []) as { category_id: string; effective_month: string; amount: number }[],
      monthKey,
      (f) => f.category_id,
    );
    setPresupuestos(new Map([...b].map(([k, v]) => [k, Number(v.amount)])));

    const i = vigentesPorClave(
      (incomesRes.data ?? []) as { user_id: string; effective_month: string; amount: number }[],
      monthKey,
      (f) => f.user_id,
    );
    setIngresos(new Map([...i].map(([k, v]) => [k, Number(v.amount)])));
  }, [supabase, householdId, monthKey, monthEnd]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => onExpensesChanged(load), [load]);

  if (loading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  const miGasto = gastos.reduce((sum, g) => sum + shareOf(g, userId), 0);
  const miIngreso = ingresos.get(userId) ?? 0;
  const miAhorro = miIngreso - miGasto;

  const suGasto = partnerId
    ? gastos.reduce((sum, g) => sum + shareOf(g, partnerId), 0)
    : 0;
  const suIngreso = partnerId ? (ingresos.get(partnerId) ?? 0) : 0;

  const filas: Fila[] = categories
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      color: c.color,
      total: gastos
        .filter((g) => g.category_id === c.id)
        .reduce((sum, g) => sum + Number(g.amount), 0),
      budget: presupuestos.get(c.id) ?? null,
    }))
    .filter((f) => f.total > 0 || (f.budget ?? 0) > 0);

  const conTope = filas.filter((f) => (f.budget ?? 0) > 0);
  const conGasto = [...filas].filter((f) => f.total > 0).sort((a, b) => b.total - a.total);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">Tu mes</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Ingreso</p>
            <p className="mt-1 text-lg font-semibold">
              {miIngreso > 0 ? formatCurrency(miIngreso) : "—"}
            </p>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Gastaste</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(miGasto)}</p>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Ahorro</p>
            <p
              className={`mt-1 text-lg font-semibold ${
                miIngreso === 0 ? "" : miAhorro >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {miIngreso > 0 ? formatCurrency(miAhorro) : "—"}
            </p>
          </div>
        </div>
        {miIngreso === 0 && (
          <p className="text-xs text-muted-foreground">
            Cargá tu ingreso en Ajustes para ver cuánto estás ahorrando.
          </p>
        )}
        {partnerId && (suIngreso > 0 || suGasto > 0) && (
          <p className="text-xs text-muted-foreground">
            {partnerName ?? "Tu pareja"}: gastó {formatCurrency(suGasto)}
            {suIngreso > 0 && `, ahorra ${formatCurrency(suIngreso - suGasto)}`}.
          </p>
        )}
      </div>

      {conTope.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-muted-foreground">Presupuestos</p>
          <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-sm">
            {conTope.map((fila) => (
              <Medidor key={fila.categoryId} fila={fila} />
            ))}
          </div>
        </div>
      )}

      {conGasto.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            En qué se fue el mes
          </p>
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <ResponsiveContainer width="100%" height={conGasto.length * 38}>
              <BarChart
                data={conGasto}
                layout="vertical"
                margin={{ top: 0, right: 76, bottom: 0, left: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={104}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
                  {conGasto.map((fila) => (
                    <Cell key={fila.categoryId} fill={fila.color} />
                  ))}
                  <LabelList
                    dataKey="total"
                    position="right"
                    offset={8}
                    fill="var(--color-muted-foreground)"
                    fontSize={12}
                    formatter={(v) => formatCurrency(Number(v))}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
