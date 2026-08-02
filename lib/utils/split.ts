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
