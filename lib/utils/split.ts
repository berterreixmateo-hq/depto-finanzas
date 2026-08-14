import type { Database } from "@/lib/types/database.types";

type ExpenseRow = Pick<
  Database["public"]["Tables"]["expenses"]["Row"],
  "amount" | "paid_by" | "payer_share_percentage"
>;
type SettlementRow = Pick<
  Database["public"]["Tables"]["settlements"]["Row"],
  "amount" | "settled_by"
>;

/**
 * Cuánto de un gasto le corresponde a una persona, independientemente de
 * quién puso la plata. Es lo que esa persona consumió: la base para "cuánto
 * gastaste este mes" y, contra el ingreso, para el ahorro.
 *
 * No confundir con quién pagó: si uno adelanta el súper de los dos, gastó el
 * 50% aunque haya salido todo de su cuenta. Esa diferencia la resuelve el
 * balance, no esto.
 */
export function shareOf(expense: ExpenseRow, userId: string): number {
  const pct =
    expense.paid_by === userId
      ? expense.payer_share_percentage
      : 100 - expense.payer_share_percentage;
  return (Number(expense.amount) * Number(pct)) / 100;
}

/**
 * Devuelve cuánto le debe currentUserId al otro miembro (positivo = yo debo,
 * negativo = me deben). Cada gasto reparte el monto entre paid_by (según
 * payer_share_percentage) y el resto queda a cargo del otro miembro.
 */
export function computeBalance(
  expenses: ExpenseRow[],
  settlements: SettlementRow[],
  currentUserId: string,
  partnerUserId: string,
): number {
  let balance = 0;

  for (const expense of expenses) {
    const otherShare = (expense.amount * (100 - expense.payer_share_percentage)) / 100;
    if (expense.paid_by === currentUserId) {
      balance -= otherShare; // el otro me debe su parte
    } else if (expense.paid_by === partnerUserId) {
      balance += otherShare; // yo le debo mi parte
    }
  }

  for (const settlement of settlements) {
    // Quien salda, paga lo que debía: reduce lo que esa persona debe.
    if (settlement.settled_by === currentUserId) {
      balance -= settlement.amount;
    } else if (settlement.settled_by === partnerUserId) {
      balance += settlement.amount;
    }
  }

  return Math.round(balance * 100) / 100;
}
