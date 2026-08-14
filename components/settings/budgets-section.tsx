"use client";

import { useCallback, useEffect, useState } from "react";
import { format, startOfMonth } from "date-fns";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/household-context";
import {
  amountToInput,
  formatAmountInput,
  formatCurrency,
  parseAmountInput,
} from "@/lib/utils/currency";
import { vigentesPorClave } from "@/lib/utils/vigencia";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface BudgetRow {
  category_id: string;
  effective_month: string;
  amount: number;
}

export function BudgetsSection() {
  const supabase = createClient();
  const { householdId, categories } = useHousehold();

  const monthKey = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [vigentes, setVigentes] = useState<Map<string, BudgetRow>>(new Map());
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);

  const fetchBudgets = useCallback(async () => {
    const { data, error } = await supabase
      .from("budgets")
      .select("category_id, effective_month, amount")
      .eq("household_id", householdId)
      .lte("effective_month", monthKey);

    setLoading(false);
    if (error) {
      toast.error("No pudimos cargar los presupuestos", { description: error.message });
      return;
    }

    const filas = (data ?? []) as BudgetRow[];
    const mapa = vigentesPorClave(filas, monthKey, (f) => f.category_id);
    setVigentes(mapa);
    setBorradores(
      Object.fromEntries(
        categories.map((c) => {
          const v = mapa.get(c.id);
          return [c.id, v ? amountToInput(v.amount) : ""];
        }),
      ),
    );
  }, [supabase, householdId, monthKey, categories]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  async function guardar(categoryId: string) {
    const texto = borradores[categoryId] ?? "";
    const monto = texto.trim() === "" ? 0 : parseAmountInput(texto);

    if (!Number.isFinite(monto) || monto < 0) {
      toast.error("Ingresá un monto válido");
      return;
    }

    const vigente = vigentes.get(categoryId);
    if (vigente && Number(vigente.amount) === monto) return;

    setGuardando(categoryId);

    // Una fila por mes: si ya se tocó este mes se pisa, si no se agrega. Así
    // los meses anteriores conservan el presupuesto que tenían entonces.
    const { error } = await supabase
      .from("budgets")
      .upsert(
        {
          household_id: householdId,
          category_id: categoryId,
          effective_month: monthKey,
          amount: monto,
        },
        { onConflict: "category_id,effective_month" },
      );

    setGuardando(null);

    if (error) {
      toast.error("No pudimos guardar el presupuesto", { description: error.message });
      return;
    }
    toast.success("Presupuesto actualizado");
    fetchBudgets();
  }

  const total = categories.reduce(
    (sum, c) => sum + Number(vigentes.get(c.id)?.amount ?? 0),
    0,
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {categories.map((category) => (
        <div
          key={category.id}
          className="flex items-center gap-3 rounded-xl bg-card px-4 py-2.5 shadow-sm"
        >
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: category.color }}
          />
          <label
            htmlFor={`budget-${category.id}`}
            className="min-w-0 flex-1 truncate text-sm"
          >
            {category.name}
          </label>
          <div className="relative w-32 shrink-0">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id={`budget-${category.id}`}
              type="text"
              inputMode="decimal"
              placeholder="Sin tope"
              value={borradores[category.id] ?? ""}
              onChange={(e) =>
                setBorradores((prev) => ({
                  ...prev,
                  [category.id]: formatAmountInput(e.target.value),
                }))
              }
              onBlur={() => guardar(category.id)}
              disabled={guardando === category.id}
              className="pl-6 text-right tabular-nums"
            />
          </div>
        </div>
      ))}

      <div className="flex items-baseline justify-between px-4 pt-1">
        <span className="text-sm text-muted-foreground">Total presupuestado</span>
        <span className="font-medium tabular-nums">{formatCurrency(total)}</span>
      </div>

      <p className="px-4 text-xs text-muted-foreground">
        Se guarda al salir del campo. Cambiar un tope no toca los meses
        anteriores: cada mes conserva el que tenía.
      </p>
    </div>
  );
}
