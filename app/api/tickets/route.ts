import { NextResponse } from "next/server";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { leerTicket } from "@/lib/tickets";

/** Claude acepta imágenes hasta 5MB; recortamos antes para no gastar el viaje. */
const MAX_BYTES = 5 * 1024 * 1024;

const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "image/webp"] as const;
type TipoAceptado = (typeof TIPOS_ACEPTADOS)[number];

function esTipoAceptado(tipo: string): tipo is TipoAceptado {
  return (TIPOS_ACEPTADOS as readonly string[]).includes(tipo);
}

/**
 * Lee la foto de un ticket y devuelve sus datos, sin guardar nada.
 *
 * El guardado es un paso aparte a propósito: el OCR se equivoca, y quien
 * cargó la foto tiene que poder corregir antes de que esto toque la base.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Cada llamada cuesta plata de verdad. Que solo la disparen los miembros
  // del hogar, no cualquiera con una sesión.
  const { data: member } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "No pertenecés a un hogar" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
  }
  if (!esTipoAceptado(file.type)) {
    return NextResponse.json(
      { error: "La foto tiene que ser JPG, PNG o WebP" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "La foto pesa más de 5MB. Sacala con menos resolución." },
      { status: 400 },
    );
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("name")
    .eq("household_id", member.household_id)
    .order("name");

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const ticket = await leerTicket(
      base64,
      file.type,
      (categories ?? []).map((c) => c.name),
      format(new Date(), "yyyy-MM-dd"),
    );
    return NextResponse.json({ ticket });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No pudimos leer el ticket" },
      { status: 502 },
    );
  }
}
