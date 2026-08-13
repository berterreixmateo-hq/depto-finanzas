import type { Database } from "@/lib/types/database.types";

export type RecurringExpense =
  Database["public"]["Tables"]["recurring_expenses"]["Row"];

export type RecurringInstance =
  Database["public"]["Tables"]["recurring_expense_instances"]["Row"];

/** Una definición de servicio junto a su ocurrencia del mes que se está viendo. */
export type ServicioDelMes = RecurringExpense & {
  categories: Pick<
    Database["public"]["Tables"]["categories"]["Row"],
    "name" | "color" | "icon"
  > | null;
  instance: RecurringInstance | null;
};
