"use client";

import { useHousehold } from "@/lib/household-context";
import { AMBOS } from "@/lib/utils/payer";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * El select de "Quién pagó", compartido por los cuatro formularios que cargan un
 * gasto (a mano, ticket, cierre de compra y pago de un fijo). Vive acá porque
 * cuando cada uno tenía su copia, agregar "Pagamos los dos" en uno dejaba a los
 * otros tres sin la opción.
 */
export function PayerSelect({
  value,
  onValueChange,
  hint,
}: {
  value: string;
  onValueChange: (value: string) => void;
  /** Texto de ayuda para cuando pagó una sola persona. */
  hint?: string;
}) {
  const { userId, displayName, partnerId, partnerName } = useHousehold();

  // Base UI necesita `items` en el Root: sin eso <SelectValue> imprime el valor
  // crudo (el UUID) en vez de la etiqueta del ítem elegido.
  const items = [
    { value: userId, label: `Yo (${displayName})` },
    ...(partnerId
      ? [
          { value: partnerId, label: partnerName ?? "Mi pareja" },
          { value: AMBOS, label: "Pagamos los dos" },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-2">
      <Label>Quién pagó</Label>
      <Select
        items={items}
        value={value}
        onValueChange={(v) => v && onValueChange(v)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value === AMBOS ? (
        <p className="text-xs text-muted-foreground">
          Cada uno puso su parte: no genera deuda entre ustedes.
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
