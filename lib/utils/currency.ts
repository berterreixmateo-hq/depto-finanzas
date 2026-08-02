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
