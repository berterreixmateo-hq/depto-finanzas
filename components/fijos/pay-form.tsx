"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/household-context";
import { notifyExpensesChanged } from "@/lib/expenses-bus";
import type { ServicioDelMes } from "@/lib/types/recurring";
import { amountToInput, formatAmountInput, parseAmountInput } from "@/lib/utils/currency";
import {
  BUCKET_FACTURAS,
  MAX_FACTURA_BYTES,
  esTipoFacturaValido,
  rutaFactura,
} from "@/lib/facturas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PayForm({
  servicio,
  onSuccess,
  onCancel,
}: {
  servicio: ServicioDelMes;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const { householdId, userId, displayName, partnerId, partnerName } = useHousehold();

  // El monto real casi nunca coincide con el estimado, así que se puede
  // corregir acá; lo que se guarda como gasto es este, no el de la definición.
  const [amount, setAmount] = useState(
    amountToInput(servicio.instance?.estimated_amount ?? servicio.estimated_amount),
  );
  const [paidBy, setPaidBy] = useState(userId);
  const [factura, setFactura] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const facturaRef = useRef<HTMLInputElement>(null);

  // Centinela: no es un uuid, así que nunca choca con un user_id real.
  const AMBOS = "ambos";
  const ambos = paidBy === AMBOS;

  const payerItems = [
    { value: userId, label: `Yo (${displayName})` },
    ...(partnerId ? [{ value: partnerId, label: partnerName ?? "Mi pareja" }] : []),
    ...(partnerId ? [{ value: AMBOS, label: "Pagamos los dos" }] : []),
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const amountValue = parseAmountInput(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    if (!servicio.instance) {
      toast.error("No encontramos la cuota de este mes");
      return;
    }

    setSaving(true);

    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        household_id: householdId,
        category_id: servicio.category_id,
        description: servicio.name,
        amount: amountValue,
        expense_date: format(new Date(), "yyyy-MM-dd"),
        // Con "pagamos los dos" el gasto queda a nombre de quien lo carga,
        // porque de eso depende a quién se refiere el porcentaje; lo que cambia
        // es que `settled_on_payment` hace que no genere deuda.
        paid_by: ambos ? userId : paidBy,
        payer_share_percentage: 50,
        settled_on_payment: ambos,
        split_type: "50_50",
        source: "recurring",
        recurring_instance_id: servicio.instance.id,
        created_by: userId,
      })
      .select("id")
      .single();

    if (expenseError || !expense) {
      setSaving(false);
      toast.error("No pudimos registrar el pago", { description: expenseError?.message });
      return;
    }

    const { error: instanceError } = await supabase
      .from("recurring_expense_instances")
      .update({ status: "paid", expense_id: expense.id })
      .eq("id", servicio.instance.id);

    setSaving(false);

    if (instanceError) {
      // El gasto ya quedó cargado; si esto falla, el fijo sigue figurando
      // pendiente y volver a pagarlo duplicaría el gasto. Mejor decirlo.
      toast.error("El gasto se cargó, pero el fijo quedó como pendiente", {
        description: instanceError.message,
      });
      notifyExpensesChanged();
      onSuccess();
      return;
    }

    // La factura va al final y no bloquea: el pago ya quedó registrado, y si
    // la subida falla se puede adjuntar después desde la lista.
    if (factura) {
      const ruta = rutaFactura(householdId, servicio.instance.id, factura.name);
      const { error: subida } = await supabase.storage
        .from(BUCKET_FACTURAS)
        .upload(ruta, factura, { upsert: true, contentType: factura.type });

      if (subida) {
        toast.error("El pago se registró, pero la factura no se subió", {
          description: subida.message,
        });
      } else {
        await supabase
          .from("recurring_expense_instances")
          .update({ invoice_url: ruta })
          .eq("id", servicio.instance.id);
      }
    }

    toast.success(`${servicio.name} marcado como pagado`);
    notifyExpensesChanged();
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="pay-amount">Cuánto pagaste</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-muted-foreground">
            $
          </span>
          <Input
            id="pay-amount"
            type="text"
            inputMode="decimal"
            placeholder="0"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(formatAmountInput(e.target.value))}
            className="h-14 pl-9 text-3xl font-semibold tabular-nums"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Veníamos estimando {amountToInput(servicio.estimated_amount)}.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Quién pagó</Label>
        <Select
          items={payerItems}
          value={paidBy}
          onValueChange={(value) => value && setPaidBy(value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={userId}>Yo ({displayName})</SelectItem>
            {partnerId && (
              <SelectItem value={partnerId}>{partnerName ?? "Mi pareja"}</SelectItem>
            )}
            {partnerId && <SelectItem value={AMBOS}>Pagamos los dos</SelectItem>}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {ambos
            ? "Cada uno puso su parte: no genera deuda entre ustedes."
            : "Se divide 50/50 entre los dos."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Factura</Label>
        <input
          ref={facturaRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (!esTipoFacturaValido(f.type)) {
              toast.error("La factura tiene que ser JPG, PNG, WebP o PDF");
              return;
            }
            if (f.size > MAX_FACTURA_BYTES) {
              toast.error("La factura pesa más de 10MB");
              return;
            }
            setFactura(f);
          }}
        />
        {factura ? (
          <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-sm">
            <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{factura.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground"
              aria-label="Quitar la factura"
              onClick={() => {
                setFactura(null);
                if (facturaRef.current) facturaRef.current.value = "";
              }}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => facturaRef.current?.click()}
          >
            <Paperclip className="size-4" />
            Adjuntar factura
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          Opcional. Queda guardada en privado: para verla se genera un enlace que
          vence, así no queda una URL pública dando vueltas.
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? "Guardando…" : "Marcar pagado"}
        </Button>
      </div>
    </form>
  );
}
