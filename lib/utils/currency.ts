/**
 * Formatea montos en pesos argentinos con el formato "$ 12.500":
 * signo pesos, espacio, punto como separador de miles, coma para decimales.
 * Sin decimales cuando el monto es entero (caso más común para gastos).
 */
export function formatCurrency(amount: number): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  const sign = amount < 0 ? "-" : "";
  return `${sign}$ ${formatted}`;
}

/**
 * Normaliza lo que el usuario tipea en un campo de monto al formato es-AR:
 * punto cada mil, coma para decimales, máximo dos decimales.
 *
 * Se aplica en cada tecla, así que tiene que tolerar estados intermedios: el
 * "20," de alguien que todavía no escribió los centavos se conserva tal cual,
 * porque borrar la coma mientras escribe le impediría llegar a "20,50".
 */
export function formatAmountInput(raw: string): string {
  // Los puntos son nuestros (separador de miles) y se recalculan de cero en cada
  // tecla; la coma es del usuario y marca los decimales.
  const cleaned = raw.replace(/\./g, "");
  const [integerPart, ...rest] = cleaned.split(",");
  const digits = integerPart.replace(/\D/g, "");

  const grouped = digits ? new Intl.NumberFormat("es-AR").format(Number(digits)) : "";

  if (rest.length === 0) return grouped;

  const decimals = rest.join("").replace(/\D/g, "").slice(0, 2);
  return `${grouped || "0"},${decimals}`;
}

/**
 * Inversa de `formatAmountInput`: "20.000,50" → 20000.5. Devuelve NaN si no
 * quedó ningún dígito, para que quien llame decida el mensaje de error.
 */
export function parseAmountInput(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  if (!normalized.trim()) return NaN;
  return Number(normalized);
}

/** Number → texto del input, para precargar el formulario al editar un gasto. */
export function amountToInput(amount: number): string {
  return formatAmountInput(
    new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount),
  );
}
