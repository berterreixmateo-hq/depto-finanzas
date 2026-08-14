/**
 * Resolución del valor vigente en un mes, para las tablas con historial.
 *
 * `budgets` e `incomes` guardan una fila nueva solo cuando el monto cambia.
 * El vigente para un mes es la fila más reciente con `effective_month <= mes`,
 * de modo que un sueldo o un presupuesto que no cambió se carga una vez y
 * sigue valiendo, y los meses viejos conservan el valor que tenían entonces.
 */

export interface ConVigencia {
  effective_month: string;
  amount: number;
}

/** `monthDate` es el primer día del mes que se está mirando. */
export function vigenteEnMes<T extends ConVigencia>(
  filas: T[],
  monthKey: string,
): T | null {
  let mejor: T | null = null;

  for (const fila of filas) {
    if (fila.effective_month > monthKey) continue;
    if (!mejor || fila.effective_month > mejor.effective_month) {
      mejor = fila;
    }
  }

  return mejor;
}

/** Agrupa por una clave y devuelve el vigente de cada grupo. */
export function vigentesPorClave<T extends ConVigencia>(
  filas: T[],
  monthKey: string,
  clave: (fila: T) => string,
): Map<string, T> {
  const porClave = new Map<string, T[]>();
  for (const fila of filas) {
    const k = clave(fila);
    const lista = porClave.get(k) ?? [];
    lista.push(fila);
    porClave.set(k, lista);
  }

  const resultado = new Map<string, T>();
  for (const [k, lista] of porClave) {
    const vigente = vigenteEnMes(lista, monthKey);
    if (vigente) resultado.set(k, vigente);
  }
  return resultado;
}
