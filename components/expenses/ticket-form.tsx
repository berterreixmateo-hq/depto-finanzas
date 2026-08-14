"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/household-context";
import { notifyExpensesChanged } from "@/lib/expenses-bus";
import type { TicketData } from "@/lib/tickets";
import { amountToInput, formatAmountInput, parseAmountInput, formatCurrency } from "@/lib/utils/currency";
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

export function TicketForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const { householdId, userId, displayName, partnerId, partnerName, categories } =
    useHousehold();

  const inputRef = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [ticket, setTicket] = useState<TicketData | null>(null);

  // Campos editables: lo que devuelve el OCR es un borrador, no la verdad.
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [categoryId, setCategoryId] = useState("");
  const [paidBy, setPaidBy] = useState(userId);
  const [saving, setSaving] = useState(false);

  const categoryItems = categories.map((c) => ({ value: c.id, label: c.name }));
  const payerItems = [
    { value: userId, label: `Yo (${displayName})` },
    ...(partnerId ? [{ value: partnerId, label: partnerName ?? "Mi pareja" }] : []),
  ];

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLeyendo(true);
    const body = new FormData();
    body.append("file", file);

    try {
      const res = await fetch("/api/tickets", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No pudimos leer el ticket");

      const data = json.ticket as TicketData;
      setTicket(data);
      setDescription(data.merchant ?? "");
      setAmount(data.total !== null ? amountToInput(data.total) : "");
      if (data.date) setDate(data.date);

      const sugerida = categories.find(
        (c) => c.name.toLowerCase() === data.suggestedCategory?.toLowerCase(),
      );
      setCategoryId(sugerida?.id ?? categories[0]?.id ?? "");
    } catch (error) {
      toast.error("No pudimos leer el ticket", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLeyendo(false);
      // Permite reintentar con la misma foto si la primera lectura falló.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const amountValue = parseAmountInput(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error("Revisá el total: no quedó un monto válido");
      return;
    }
    if (!description.trim()) {
      toast.error("Ponele una descripción");
      return;
    }
    if (!categoryId) {
      toast.error("Elegí una categoría");
      return;
    }

    setSaving(true);

    const { data: expense, error } = await supabase
      .from("expenses")
      .insert({
        household_id: householdId,
        category_id: categoryId,
        description: description.trim(),
        amount: amountValue,
        expense_date: date,
        paid_by: paidBy,
        payer_share_percentage: 50,
        split_type: "50_50",
        source: "ticket",
        merchant: ticket?.merchant ?? null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error || !expense) {
      setSaving(false);
      toast.error("No pudimos guardar el gasto", { description: error?.message });
      return;
    }

    // El detalle es informativo: si falla, el gasto ya quedó bien cargado y no
    // vale la pena hacer volver a la persona al formulario.
    const items = ticket?.items ?? [];
    if (items.length > 0) {
      const { error: itemsError } = await supabase.from("expense_items").insert(
        items.map((item) => ({
          expense_id: expense.id,
          household_id: householdId,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          amount: item.amount,
        })),
      );
      if (itemsError) {
        console.warn("No se guardó el detalle del ticket:", itemsError.message);
      }
    }

    setSaving(false);
    toast.success("Gasto cargado desde el ticket");
    notifyExpensesChanged();
    onSuccess();
  }

  if (!ticket) {
    return (
      <div className="flex flex-col gap-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />

        <button
          type="button"
          disabled={leyendo}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10 text-center transition-colors hover:bg-muted disabled:opacity-60"
        >
          {leyendo ? (
            <>
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Leyendo el ticket…
              </span>
            </>
          ) : (
            <>
              <Camera className="size-8 text-muted-foreground" />
              <span className="font-medium">Sacale una foto al ticket</span>
              <span className="text-xs text-muted-foreground">
                Que se lea el total y los productos. JPG, PNG o WebP, hasta 5MB.
              </span>
            </>
          )}
        </button>

        <Button type="button" variant="outline" onClick={onCancel} disabled={leyendo}>
          Cancelar
        </Button>
      </div>
    );
  }

  const sumaItems = ticket.items.reduce((sum, i) => sum + Number(i.amount), 0);
  const total = parseAmountInput(amount);
  // Los descuentos hacen que el total sea menor que la suma; una diferencia
  // grande en la otra dirección suele ser una línea mal leída.
  const hayDesvio =
    ticket.items.length > 0 && Number.isFinite(total) && total > sumaItems * 1.05;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="ticket-amount">Total</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-muted-foreground">
            $
          </span>
          <Input
            id="ticket-amount"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(formatAmountInput(e.target.value))}
            className="h-14 pl-9 text-3xl font-semibold tabular-nums"
          />
        </div>
        {ticket.total === null && (
          <p className="text-xs text-warning">
            No pudimos leer el total. Cargalo a mano mirando el ticket.
          </p>
        )}
        {hayDesvio && (
          <p className="text-xs text-warning">
            El total supera la suma de los productos ({formatCurrency(sumaItems)}).
            Puede faltar alguna línea; verificá antes de guardar.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ticket-description">Descripción</Label>
        <Input
          id="ticket-description"
          placeholder="Ej: Coto"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Categoría</Label>
        <Select
          items={categoryItems}
          value={categoryId}
          onValueChange={(value) => value && setCategoryId(value)}
        >
          <SelectTrigger className="w-full" disabled={categories.length === 0}>
            <SelectValue placeholder="Elegí una categoría" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ticket-date">Fecha</Label>
          <Input
            id="ticket-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
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
            </SelectContent>
          </Select>
        </div>
      </div>

      {ticket.items.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>
            {ticket.items.length} producto{ticket.items.length === 1 ? "" : "s"} leído
            {ticket.items.length === 1 ? "" : "s"}
          </Label>
          <div className="max-h-44 overflow-y-auto rounded-xl bg-card p-1">
            {ticket.items.map((item, i) => (
              <div
                key={`${item.name}-${i}`}
                className="flex items-baseline gap-2 px-3 py-1.5 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Se guardan como detalle del gasto. El monto que cuenta para el balance
            y los presupuestos es el total de arriba.
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? "Guardando…" : "Cargar gasto"}
        </Button>
      </div>
    </form>
  );
}
