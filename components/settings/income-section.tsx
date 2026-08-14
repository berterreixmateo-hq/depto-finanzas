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

interface IncomeRow {
  user_id: string;
  effective_month: string;
  amount: number;
}

export function IncomeSection() {
  const supabase = createClient();
  const { householdId, userId, displayName, partnerId, partnerName } = useHousehold();

  const monthKey = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [vigentes, setVigentes] = useState<Map<string, IncomeRow>>(new Map());
  const [borrador, setBorrador] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const fetchIncomes = useCallback(async () => {
    const { data, error } = await supabase
      .from("incomes")
      .select("user_id, effective_month, amount")
      .eq("household_id", householdId)
      .lte("effective_month", monthKey);

    setLoading(false);
    if (error) {
      toast.error("No pudimos cargar los ingresos", { description: error.message });
      return;
    }

    const mapa = vigentesPorClave((data ?? []) as IncomeRow[], monthKey, (f) => f.user_id);
    setVigentes(mapa);
    const mio = mapa.get(userId);
    setBorrador(mio ? amountToInput(mio.amount) : "");
  }, [supabase, householdId, monthKey, userId]);

  useEffect(() => {
    fetchIncomes();
  }, [fetchIncomes]);

  async function guardar() {
    const monto = borrador.trim() === "" ? 0 : parseAmountInput(borrador);
    if (!Number.isFinite(monto) || monto < 0) {
      toast.error("Ingresá un monto válido");
      return;
    }

    const vigente = vigentes.get(userId);
    if (vigente && Number(vigente.amount) === monto) return;

    setGuardando(true);
    const { error } = await supabase.from("incomes").upsert(
      {
        household_id: householdId,
        user_id: userId,
        effective_month: monthKey,
        amount: monto,
      },
      { onConflict: "user_id,effective_month" },
    );
    setGuardando(false);

    if (error) {
      toast.error("No pudimos guardar tu ingreso", { description: error.message });
      return;
    }
    toast.success("Ingreso actualizado");
    fetchIncomes();
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  const delPartner = partnerId ? vigentes.get(partnerId) : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-2.5 shadow-sm">
        <label htmlFor="income-mio" className="min-w-0 flex-1 truncate text-sm">
          {displayName} (vos)
        </label>
        <div className="relative w-36 shrink-0">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <Input
            id="income-mio"
            type="text"
            inputMode="decimal"
            placeholder="Sin cargar"
            value={borrador}
            onChange={(e) => setBorrador(formatAmountInput(e.target.value))}
            onBlur={guardar}
            disabled={guardando}
            className="pl-6 text-right tabular-nums"
          />
        </div>
      </div>

      {partnerId && (
        <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-2.5 shadow-sm">
          <span className="min-w-0 flex-1 truncate text-sm">
            {partnerName ?? "Tu pareja"}
          </span>
          <span className="w-36 shrink-0 pr-3 text-right text-sm tabular-nums text-muted-foreground">
            {delPartner ? formatCurrency(delPartner.amount) : "Sin cargar"}
          </span>
        </div>
      )}

      <p className="px-4 text-xs text-muted-foreground">
        Cada uno carga el propio; los dos ven ambos. Como con los presupuestos,
        se guarda una fila nueva solo cuando el monto cambia, así los meses
        anteriores conservan el ingreso que tenías entonces.
      </p>
    </div>
  );
}
