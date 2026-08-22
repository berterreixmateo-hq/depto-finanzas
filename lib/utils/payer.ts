// Centinela de "pagamos los dos": no es un uuid, así que nunca choca con un
// user_id real.
export const AMBOS = "ambos";

/**
 * Cómo se guardan en `expenses` los campos que dependen de quién pagó.
 *
 * Con "pagamos los dos" el gasto queda a nombre de quien lo carga, porque de esa
 * persona depende a quién se refiere `payer_share_percentage`; lo único que
 * cambia es que `settled_on_payment` hace que el balance lo saltee.
 */
export function camposDePagador(paidBy: string, userId: string) {
  const ambos = paidBy === AMBOS;
  return { paid_by: ambos ? userId : paidBy, settled_on_payment: ambos };
}
