"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>Cargar gasto</DialogTitle>
              <Badge variant="secondary">Fase 2</Badge>
            </div>
            <DialogDescription>
              Acá vas a poder cargar un gasto en segundos: monto, categoría y listo. Todavía
              no está conectado — llega en la próxima fase.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
