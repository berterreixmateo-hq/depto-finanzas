"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/household-context";
import { notifyExpensesChanged } from "@/lib/expenses-bus";
import {
  amountToInput,
  formatAmountInput,
  formatCurrency,
  parseAmountInput,
} from "@/lib/utils/currency";
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

export interface ItemComprado {
  id: string;
  name: string;
  quantity: string | null;
  precio: number | null;
}

/**
 * Cierra una compra: los ítems tachados se convierten en un gasto y salen de
 * la lista.
 *
 * El total arranca con la suma de los precios de Coto que conocemos, pero es
 * un estimado —faltan los ítems sin vincular, y el precio real puede haber
 * cambiado— así que el campo es editable y se avisa cuántos quedaron afuera.
 * Quien quiera el número exacto tiene el lector de tickets.
 */
export function CerrarCompraForm({
  items,
  onSuccess,
  onCancel,
}: {
  items: ItemComprado[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const { householdId, userId, displayName, partnerId, partnerName, categories } =
    useHousehold();

  const conocidos = items.filter((i) => typeof i.precio === "number");
  const estimado = conocidos.reduce((sum, i) => sum + (i.precio ?? 0), 0);
  const sinPrecio = items.length - conocidos.length;

  const supermercado = categories.find((c) => c.name === "Supermercado");

  const [amount, setAmount] = useState(estimado > 0 ? amountToInput(estimado) : "");
  const [categoryId, setCategoryId] = useState(supermercado?.id ?? categories[0]?.id ?? "");
  const [paidBy, setPaidBy] = useState(userId);
  const [saving, setSaving] = useState(false);

  const categoryItems = categories.map((c) => ({ value: c.id, label: c.name }));
  const payerItems = [
    { value: userId, label: `Yo (${displayName})` },
    ...(partnerId ? [{ value: partnerId, label: partnerName ?? "Mi pareja" }] : []),
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const total = parseAmountInput(amount);
    if (!Number.isFinite(total) || total <= 0) {
      toast.error("Ingresá cuánto pagaste");
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
        description: `Compra de súper (${items.length} producto${items.length === 1 ? "" : "s"})`,
        amount: total,
        expense_date: format(new Date(), "yyyy-MM-dd"),
        paid_by: paidBy,
        payer_share_percentage: 50,
        split_type: "50_50",
        source: "shopping",
        created_by: userId,
      })
      .select("id")
      .single();

    if (error || !expense) {
      setSaving(false);
      toast.error("No pudimos cargar el gasto", { description: error?.message });
      return;
    }

    // El detalle de lo comprado se guarda igual que el de un ticket: sirve para
    // mirar qué se llevó, pero el monto que cuenta es el total del gasto.
    await supabase.from("expense_items").insert(
      items.map((i) => ({
        expense_id: expense.id,
        household_id: householdId,
        name: i.quantity ? `${i.name} (${i.quantity})` : i.name,
        // null y no 0: no sabemos el precio, no es que haya salido gratis.
        amount: i.precio,
      })),
    );

    // Recién ahora salen de la lista: si el gasto hubiera fallado, la compra
    // seguiría ahí para reintentar.
    const { error: borrado } = await supabase
      .from("shopping_items")
      .delete()
      .in("id", items.map((i) => i.id));

    setSaving(false);

    if (borrado) {
      toast.error("El gasto quedó cargado, pero los ítems siguen en la lista", {
        description: borrado.message,
      });
    } else {
      toast.success("Compra cerrada y gasto cargado");
    }

    notifyExpensesChanged();
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="compra-total">Cuánto pagaste</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-muted-foreground">
            $
          </span>
          <Input
            id="compra-total"
            type="text"
            inputMode="decimal"
            placeholder="0"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(formatAmountInput(e.target.value))}
            className="h-14 pl-9 text-3xl font-semibold tabular-nums"
          />
        </div>
        {estimado > 0 ? (
          <p className="text-xs text-muted-foreground">
            Estimado de Coto: {formatCurrency(estimado)}
            {sinPrecio > 0 &&
              ` — no incluye ${sinPrecio} producto${sinPrecio === 1 ? "" : "s"} sin precio`}
            . Corregilo con lo que dice el ticket.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Ninguno de los productos tenía precio, así que el total lo ponés vos.
          </p>
        )}
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
        <p className="text-xs text-muted-foreground">Se divide 50/50 entre los dos.</p>
      </div>

      <div className="max-h-32 overflow-y-auto rounded-xl bg-card p-1">
        {items.map((i) => (
          <div key={i.id} className="flex items-baseline gap-2 px-3 py-1 text-sm">
            <span className="min-w-0 flex-1 truncate">
              {i.name}
              {i.quantity && (
                <span className="ml-1.5 text-xs text-muted-foreground">{i.quantity}</span>
              )}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {typeof i.precio === "number" ? formatCurrency(i.precio) : "—"}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? "Guardando…" : "Cerrar compra"}
        </Button>
      </div>
    </form>
  );
}
