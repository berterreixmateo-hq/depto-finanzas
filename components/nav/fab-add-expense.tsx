"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpenseDialog } from "@/components/expenses/expense-dialog";

export function FabAddExpense() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Cargar gasto"
        className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-1/2 z-50 size-14 -translate-x-1/2 rounded-full shadow-lg md:hidden"
      >
        <Plus className="size-6" />
      </Button>

      <ExpenseDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
