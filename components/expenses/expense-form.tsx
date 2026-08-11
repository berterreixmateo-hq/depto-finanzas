"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/household-context";
import { notifyExpensesChanged } from "@/lib/expenses-bus";
import type { ExpenseWithCategory } from "@/lib/types/expense";
import type { SplitType } from "@/lib/types/database.types";
import { amountToInput, formatAmountInput, parseAmountInput } from "@/lib/utils/currency";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

function todayLocal() {
  return format(new Date(), "yyyy-MM-dd");
}

export function ExpenseForm({
  expense,
  onSuccess,
  onCancel,
}: {
  expense?: ExpenseWithCategory;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const { householdId, userId, displayName, partnerId, partnerName, categories } =
    useHousehold();

  const [amount, setAmount] = useState(expense ? amountToInput(expense.amount) : "");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [categoryId, setCategoryId] = useState(
    expense?.category_id ?? categories[0]?.id ?? "",
  );
  const [date, setDate] = useState(expense?.expense_date ?? todayLocal());
  const [paidBy, setPaidBy] = useState(expense?.paid_by ?? userId);
  const [splitType, setSplitType] = useState<SplitType>(
    expense?.split_type ?? "50_50",
  );
  const [customPercentage, setCustomPercentage] = useState(
    expense && expense.split_type === "custom"
      ? String(expense.payer_share_percentage)
      : "50",
  );
  const [saving, setSaving] = useState(false);

  const payerLabel = paidBy === userId ? "mío" : `de ${partnerName}`;

  // Base UI necesita `items` en el Root: sin eso <SelectValue> imprime el valor
  // crudo (el UUID) en vez de la etiqueta del ítem elegido.
  const categoryItems = categories.map((category) => ({
    value: category.id,
    label: category.name,
  }));
  const payerItems = [
    { value: userId, label: `Yo (${displayName})` },
    ...(partnerId ? [{ value: partnerId, label: partnerName ?? "Mi pareja" }] : []),
  ];

  function payerSharePercentage(): number {
    if (splitType === "50_50") return 50;
    if (splitType === "only_payer") return 100;
    const value = Number(customPercentage);
    return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 50;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const amountValue = parseAmountInput(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    if (!description.trim()) {
      toast.error("Ingresá una descripción");
      return;
    }
    if (!categoryId) {
      toast.error("Elegí una categoría");
      return;
    }

    setSaving(true);

    const payload = {
      household_id: householdId,
      category_id: categoryId,
      description: description.trim(),
      amount: amountValue,
      expense_date: date,
      paid_by: paidBy,
      payer_share_percentage: payerSharePercentage(),
      split_type: splitType,
      created_by: userId,
    };

    const { error } = expense
      ? await supabase.from("expenses").update(payload).eq("id", expense.id)
      : await supabase.from("expenses").insert(payload);

    setSaving(false);

    if (error) {
      toast.error("No pudimos guardar el gasto", { description: error.message });
      return;
    }

    toast.success(expense ? "Gasto actualizado" : "Gasto cargado");
    notifyExpensesChanged();
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="expense-amount">Monto</Label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-muted-foreground">
            $
          </span>
          <Input
            id="expense-amount"
            type="text"
            inputMode="decimal"
            placeholder="0"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(formatAmountInput(e.target.value))}
            className="h-14 pl-9 text-3xl font-semibold tabular-nums"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="expense-description">Descripción</Label>
        <Input
          id="expense-description"
          placeholder="Ej: Verdulería"
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
        {categories.length === 0 && (
          <p className="text-xs text-danger">
            Tu hogar todavía no tiene categorías. Recargá la página para crearlas.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="expense-date">Fecha</Label>
          <Input
            id="expense-date"
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
                <SelectItem value={partnerId}>{partnerName}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Cómo se divide</Label>
        <ToggleGroup
          value={[splitType]}
          onValueChange={(value) => value[0] && setSplitType(value[0] as SplitType)}
          className="grid w-full grid-cols-3"
        >
          <ToggleGroupItem value="50_50" className="text-xs">
            50/50
          </ToggleGroupItem>
          <ToggleGroupItem value="only_payer" className="text-xs capitalize">
            Solo {payerLabel}
          </ToggleGroupItem>
          <ToggleGroupItem value="custom" className="text-xs">
            Personalizado
          </ToggleGroupItem>
        </ToggleGroup>
        {splitType === "custom" && (
          <div className="flex items-center gap-2 pt-1">
            <Input
              type="number"
              min="0"
              max="100"
              value={customPercentage}
              onChange={(e) => setCustomPercentage(e.target.value)}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">
              % le corresponde a quien pagó, el resto al otro
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? "Guardando…" : expense ? "Guardar cambios" : "Cargar gasto"}
        </Button>
      </div>
    </form>
  );
}
