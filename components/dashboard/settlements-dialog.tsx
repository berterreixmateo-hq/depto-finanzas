"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/household-context";
import { notifyExpensesChanged } from "@/lib/expenses-bus";
import { formatCurrency } from "@/lib/utils/currency";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Saldo {
  id: string;
  amount: number;
  settled_by: string;
  created_at: string;
}

/**
 * Historial de "Saldar", con la posibilidad de deshacer uno.
 *
 * Existe porque un saldo puede quedar sin respaldo: se registra contra el
 * balance del momento y no guarda contra qué gastos se calculó, así que si
 * después se borran esos gastos el saldo sigue vivo y el balance queda al
 * revés. Sin esta pantalla la única salida era el SQL Editor.
 */
export function SettlementsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = createClient();
  const { householdId, userId, displayName, partnerName } = useHousehold();

  const [loading, setLoading] = useState(true);
  const [saldos, setSaldos] = useState<Saldo[]>([]);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("settlements")
      .select("id, amount, settled_by, created_at")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false });

    setLoading(false);
    if (error) {
      toast.error("No pudimos cargar el historial", { description: error.message });
      return;
    }
    setSaldos((data ?? []) as Saldo[]);
  }, [supabase, householdId]);

  useEffect(() => {
    if (open) {
      setConfirmando(null);
      load();
    }
  }, [open, load]);

  async function deshacer(id: string) {
    const { error } = await supabase.from("settlements").delete().eq("id", id);
    if (error) {
      toast.error("No pudimos deshacer el saldo", { description: error.message });
      return;
    }
    toast.success("Saldo deshecho");
    setConfirmando(null);
    setSaldos((prev) => prev.filter((s) => s.id !== id));
    notifyExpensesChanged();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saldos registrados</DialogTitle>
          <DialogDescription>
            Cada vez que tocan &ldquo;Saldar&rdquo; queda una fila acá. Deshacer una
            devuelve ese monto al balance entre ustedes.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : saldos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Todavía no saldaron nada.
          </p>
        ) : (
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {saldos.map((saldo) => {
              const quien =
                saldo.settled_by === userId ? displayName : partnerName ?? "Tu pareja";
              return (
                <div
                  key={saldo.id}
                  className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      Pagó {quien} · {formatCurrency(saldo.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(saldo.created_at), "d 'de' MMMM yyyy, HH:mm", {
                        locale: es,
                      })}
                    </p>
                  </div>
                  {confirmando === saldo.id ? (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmando(null)}
                      >
                        No
                      </Button>
                      <Button size="sm" onClick={() => deshacer(saldo.id)}>
                        Deshacer
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0 text-muted-foreground hover:text-danger"
                      aria-label={`Deshacer el saldo de ${formatCurrency(saldo.amount)}`}
                      onClick={() => setConfirmando(saldo.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
