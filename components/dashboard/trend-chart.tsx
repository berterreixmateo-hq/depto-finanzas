"use client";

import { useCallback, useEffect, useState } from "react";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/household-context";
import { onExpensesChanged } from "@/lib/expenses-bus";
import { formatCurrency } from "@/lib/utils/currency";
import { Skeleton } from "@/components/ui/skeleton";

const MESES = 6;

interface Punto {
  mes: string;
  etiqueta: string;
  total: number;
  /** Solo el último mes lo lleva: un valor sobre cada punto es ruido. */
  valorVisible: string;
}

export function TrendChart() {
  const supabase = createClient();
  const { householdId } = useHousehold();

  const [loading, setLoading] = useState(true);
  const [puntos, setPuntos] = useState<Punto[]>([]);

  const load = useCallback(async () => {
    const hoy = new Date();
    const desde = format(startOfMonth(subMonths(hoy, MESES - 1)), "yyyy-MM-dd");
    const hasta = format(endOfMonth(hoy), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("expenses")
      .select("amount, expense_date")
      .eq("household_id", householdId)
      .gte("expense_date", desde)
      .lte("expense_date", hasta);

    setLoading(false);
    if (error) {
      toast.error("No pudimos cargar la evolución", { description: error.message });
      return;
    }

    // Se arma la serie desde los meses, no desde los datos: un mes sin gastos
    // tiene que aparecer en cero y no desaparecer del eje.
    const serie: Punto[] = [];
    for (let i = MESES - 1; i >= 0; i--) {
      const mes = startOfMonth(subMonths(hoy, i));
      const clave = format(mes, "yyyy-MM");
      serie.push({
        mes: clave,
        etiqueta: format(mes, "LLL", { locale: es }),
        total: (data ?? [])
          .filter((e) => e.expense_date.startsWith(clave))
          .reduce((sum, e) => sum + Number(e.amount), 0),
        valorVisible: "",
      });
    }
    const ultimo = serie[serie.length - 1];
    ultimo.valorVisible = formatCurrency(ultimo.total);
    setPuntos(serie);
  }, [supabase, householdId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => onExpensesChanged(load), [load]);

  if (loading) return <Skeleton className="h-48 w-full rounded-2xl" />;

  const conGasto = puntos.filter((p) => p.total > 0).length;
  if (conGasto < 2) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-muted-foreground">Últimos 6 meses</p>
      <div className="rounded-2xl bg-card p-4 pt-6 shadow-sm">
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={puntos} margin={{ top: 12, right: 52, bottom: 0, left: 12 }}>
            <defs>
              {/* Un lavado, no un bloque saturado: la línea es la que lleva el dato. */}
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.16} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="etiqueta"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
            />
            <YAxis hide />
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--color-primary)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="url(#trendFill)"
              isAnimationActive={false}
              dot={false}
              activeDot={false}
            >
              {/* El margen derecho del chart le deja lugar: centrado sobre el
                  último punto, la mitad del texto caería fuera del área. */}
              <LabelList
                dataKey="valorVisible"
                position="top"
                offset={10}
                fill="var(--color-muted-foreground)"
                fontSize={12}
              />
            </Area>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
