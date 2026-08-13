import { differenceInCalendarMonths, parseISO } from "date-fns";
import type { RecurringExpense } from "@/lib/types/recurring";

export type Frequency = RecurringExpense["frequency"];

/** Cada cuántos meses vuelve a caer el gasto. */
export const MONTHS_BY_FREQUENCY: Record<Frequency, number> = {
  mensual: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  mensual: "Mensual",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export type Ocurrencia =
  /** No corresponde a este mes (todavía no arrancó, o cae en otro mes del ciclo). */
  | { aplica: false; terminado: boolean }
  /** Corresponde. `numero` y `total` solo vienen si es un gasto en cuotas. */
  | { aplica: true; terminado: false; numero: number | null; total: number | null };

/**
 * Resuelve si un gasto fijo cae en un mes dado, contando desde `start_month`.
 *
 * `monthDate` tiene que ser el primer día del mes que se está mirando.
 */
export function ocurrenciaEnMes(
  servicio: Pick<
    RecurringExpense,
    "start_month" | "frequency" | "installments_total"
  >,
  monthDate: Date,
): Ocurrencia {
  const inicio = parseISO(servicio.start_month);
  const meses = differenceInCalendarMonths(monthDate, inicio);

  if (meses < 0) return { aplica: false, terminado: false };

  const paso = MONTHS_BY_FREQUENCY[servicio.frequency];
  if (meses % paso !== 0) return { aplica: false, terminado: false };

  const numero = meses / paso + 1;
  const total = servicio.installments_total;

  if (total !== null && numero > total) {
    return { aplica: false, terminado: true };
  }

  return {
    aplica: true,
    terminado: false,
    numero: total === null ? null : numero,
    total,
  };
}

/** "Cuota 3/12 · faltan 9" — null si es un recurrente sin fin. */
export function cuotaLabel(ocurrencia: Ocurrencia): string | null {
  if (!ocurrencia.aplica || ocurrencia.numero === null || ocurrencia.total === null) {
    return null;
  }
  const restantes = ocurrencia.total - ocurrencia.numero;
  if (restantes === 0) return `Cuota ${ocurrencia.numero}/${ocurrencia.total} · última`;
  return `Cuota ${ocurrencia.numero}/${ocurrencia.total} · ${
    restantes === 1 ? "falta 1" : `faltan ${restantes}`
  }`;
}
