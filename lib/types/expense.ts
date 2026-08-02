import type { Database } from "@/lib/types/database.types";

export type Expense = Database["public"]["Tables"]["expenses"]["Row"];

export type ExpenseWithCategory = Expense & {
  categories: Pick<
    Database["public"]["Tables"]["categories"]["Row"],
    "name" | "color" | "icon"
  > | null;
};
