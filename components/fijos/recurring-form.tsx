"use client";

import { useState } from "react";
import { format, startOfMonth } from "date-fns";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/lib/household-context";
import type { RecurringExpense } from "@/lib/types/recurring";
import { amountToInput, formatAmountInput, parseAmountInput } from "@/lib/utils/currency";
import { FREQUENCY_LABELS, type Frequency } from "@/lib/utils/recurrence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RecurringForm({
  servicio,
  onSuccess,
  onCancel,
}: {
  servicio?: RecurringExpense;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const { householdId, categories } = useHousehold();

  const [name, setName] = useState(servicio?.name ?? "");
  const [amount, setAmount] = useState(
    servicio ? amountToInput(servicio.estimated_amount) : "",
  );
  const [categoryId, setCategoryId] = useState(
    servicio?.category_id ?? categories[0]?.id ?? "",
  );
  const [dayOfMonth, setDayOfMonth] = useState(String(servicio?.day_of_month ?? 10));
  const [paymentUrl, setPaymentUrl] = useState(servicio?.payment_url ?? "");
  const [notes, setNotes] = useState(servicio?.notes ?? "");
  const [frequency, setFrequency] = useState<Frequency>(servicio?.frequency ?? "mensual");
  const [startMonth, setStartMonth] = useState(
    (servicio?.start_month ?? format(startOfMonth(new Date()), "yyyy-MM-dd")).slice(0, 7),
  );
  const [enCuotas, setEnCuotas] = useState(servicio?.installments_total != null);
  const [installments, setInstallments] = useState(
    String(servicio?.installments_total ?? 12),
  );
  const [saving, setSaving] = useState(false);

  const frequencyItems = (Object.keys(FREQUENCY_LABELS) as Frequency[]).map((value) => ({
    value,
    label: FREQUENCY_LABELS[value],
  }));

  const categoryItems = categories.map((category) => ({
    value: category.id,
    label: category.name,
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Ponele un nombre al servicio");
      return;
    }

    const amountValue = parseAmountInput(amount);
    if (!Number.isFinite(amountValue) || amountValue < 0) {
      toast.error("Ingresá un monto estimado válido");
      return;
    }

    const day = Number(dayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      toast.error("El día de vencimiento va del 1 al 31");
      return;
    }

    // Mismo criterio que el CHECK de la base: la URL termina en un href,
    // así que solo se aceptan esquemas navegables.
    const url = paymentUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast.error("El link tiene que empezar con http:// o https://");
      return;
    }

    const cuotas = enCuotas ? Number(installments) : null;
    if (cuotas !== null && (!Number.isInteger(cuotas) || cuotas < 1)) {
      toast.error("La cantidad de cuotas tiene que ser 1 o más");
      return;
    }

    setSaving(true);

    const payload = {
      household_id: householdId,
      name: name.trim(),
      category_id: categoryId,
      estimated_amount: amountValue,
      day_of_month: day,
      payment_url: url || null,
      notes: notes.trim() || null,
      frequency,
      // El input type="month" da "yyyy-MM"; la columna es date y el CHECK
      // exige día 1.
      start_month: `${startMonth}-01`,
      installments_total: cuotas,
    };

    const { error } = servicio
      ? await supabase.from("recurring_expenses").update(payload).eq("id", servicio.id)
      : await supabase.from("recurring_expenses").insert(payload);

    setSaving(false);

    if (error) {
      toast.error("No pudimos guardar el servicio", { description: error.message });
      return;
    }

    toast.success(servicio ? "Servicio actualizado" : "Servicio agregado");
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="servicio-name">Nombre</Label>
        <Input
          id="servicio-name"
          placeholder="Ej: Edenor"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="servicio-amount">Monto estimado</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id="servicio-amount"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(formatAmountInput(e.target.value))}
              className="pl-7 tabular-nums"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="servicio-day">Vence el día</Label>
          <Input
            id="servicio-day"
            type="number"
            inputMode="numeric"
            min="1"
            max="31"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
          />
        </div>
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
          <Label>Cada cuánto</Label>
          <Select
            items={frequencyItems}
            value={frequency}
            onValueChange={(value) => value && setFrequency(value as Frequency)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {frequencyItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="servicio-start">Desde</Label>
          <Input
            id="servicio-start"
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enCuotas}
            onChange={(e) => setEnCuotas(e.target.checked)}
            className="size-4 accent-primary"
          />
          Es en cuotas y se termina
        </label>
        {enCuotas && (
          <div className="flex items-center gap-2">
            <Input
              id="servicio-installments"
              type="number"
              inputMode="numeric"
              min="1"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">cuotas en total</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="servicio-url">Link para pagar</Label>
        <Input
          id="servicio-url"
          type="url"
          inputMode="url"
          placeholder="https://www.edenor.com"
          value={paymentUrl}
          onChange={(e) => setPaymentUrl(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Opcional. La página donde entrás a pagarlo.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="servicio-notes">Notas</Label>
        <Textarea
          id="servicio-notes"
          rows={2}
          placeholder="Nº de cliente 123456 · se paga con la Visa"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Opcional. Lo que necesitás tener a mano al momento de pagar.
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? "Guardando…" : servicio ? "Guardar" : "Agregar"}
        </Button>
      </div>
    </form>
  );
}
