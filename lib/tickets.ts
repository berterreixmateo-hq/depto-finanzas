import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Lectura de tickets de compra con Claude.
 *
 * Se usa Haiku 4.5 porque es lo que costeamos: alrededor de medio centavo de
 * dólar por ticket. Si la extracción resultara imprecisa, subir a un modelo
 * mayor es cambiar esta constante — con el costo por ticket multiplicándose.
 */
const MODEL = "claude-haiku-4-5";

export interface TicketItem {
  name: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number;
}

export interface TicketData {
  merchant: string | null;
  /** ISO yyyy-MM-dd, o null si el ticket no la trae legible. */
  date: string | null;
  total: number | null;
  items: TicketItem[];
  /** Categoría sugerida, de las que existen en el hogar. */
  suggestedCategory: string | null;
}

const SCHEMA = {
  type: "object",
  properties: {
    merchant: {
      type: ["string", "null"],
      description: "Nombre del comercio, tal como figura en el ticket.",
    },
    date: {
      type: ["string", "null"],
      description: "Fecha de la compra en formato yyyy-MM-dd.",
    },
    total: {
      type: ["number", "null"],
      description: "Total final pagado, después de descuentos.",
    },
    suggestedCategory: {
      type: ["string", "null"],
      description:
        "La categoría de la lista provista que mejor describe la compra completa.",
    },
    items: {
      type: "array",
      description: "Una entrada por línea de producto del ticket.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: ["number", "null"] },
          unitPrice: { type: ["number", "null"] },
          amount: { type: "number", description: "Importe de esa línea." },
        },
        required: ["name", "quantity", "unitPrice", "amount"],
        additionalProperties: false,
      },
    },
  },
  required: ["merchant", "date", "total", "suggestedCategory", "items"],
  additionalProperties: false,
} as const;

function prompt(categories: string[], today: string): string {
  return `Extraé los datos de este ticket de compra argentino.

Categorías disponibles para clasificar la compra completa:
${categories.map((c) => `- ${c}`).join("\n")}

Reglas:
- Los montos vienen en pesos argentinos con punto de miles y coma decimal ("1.234,50" son mil doscientos treinta y cuatro con cincuenta). Devolvelos como números, sin separadores: 1234.5
- El total es el importe final efectivamente pagado, después de descuentos y promociones. No es la suma de las líneas si hubo descuentos.
- Ignorá líneas que no son productos: subtotales, descuentos, IVA, medios de pago, códigos de barras, leyendas fiscales.
- Si un dato no se lee con certeza, devolvé null en vez de adivinar. Es preferible un campo vacío que un número inventado: quien cargó el ticket va a revisar y completar.
- La fecha de hoy es ${today}; usala para desambiguar formatos, pero no la inventes si el ticket no muestra fecha.`;
}

export async function leerTicket(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  categories: string[],
  today: string,
): Promise<TicketData> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: prompt(categories, today) },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("El modelo rechazó procesar la imagen");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("El ticket es demasiado largo para procesarlo de una vez");
  }

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("El modelo no devolvió datos");
  }

  return JSON.parse(text.text) as TicketData;
}
