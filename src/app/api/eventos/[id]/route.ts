import { NextResponse } from "next/server";
import { adminClientDisponible, createAdminClient } from "@/lib/supabase/admin";
import { autorizarPeticion, esUUID } from "@/lib/api/autorizar";
import { parseEventoCatalogo } from "@/lib/validation/parseEventoCatalogo";
import { LIMITES, rateLimitHeaders } from "@/lib/rateLimit";

export const runtime = "nodejs";

type Contexto = { params: Promise<{ id: string }> };

function catalogoNoDisponible() {
  console.error(
    "Escritura en el catálogo sin SUPABASE_SERVICE_ROLE_KEY: 0008 revocó la escritura directa.",
  );
  return NextResponse.json(
    { error: "El catálogo no está disponible en este ambiente." },
    { status: 503 },
  );
}

/**
 * EDITAR UN EVENTO
 * ================
 * Editar el catálogo **no reescribe cotizaciones ya hechas**: cada
 * cotización guarda su propia copia de aforo, días, line-up y tier. Es la
 * decisión de producto que hace que un precio enviado a una marca siga
 * siendo explicable seis meses después.
 *
 * `activo` se acepta aparte del resto de los campos porque es el camino
 * para REACTIVAR un evento dado de baja. Bajarlo se hace con DELETE.
 */
export async function PATCH(request: Request, { params }: Contexto) {
  const { id } = await params;

  const auth = await autorizarPeticion(request, "events.edit", LIMITES.catalogoEventos, {
    sinSesion: "Inicia sesión para editar eventos.",
    sinPermiso: "Tu rol no permite editar eventos.",
  });
  if (!auth.ok) return auth.response;

  // Un id que no es UUID no llega a la consulta.
  if (!esUUID(id)) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const cuerpo = (body ?? {}) as Record<string, unknown>;

  const parsed = parseEventoCatalogo(cuerpo.evento);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Los datos del evento no son válidos.", detalles: parsed.errores },
      { status: 422 },
    );
  }
  const evento = parsed.evento;

  if (!adminClientDisponible()) return catalogoNoDisponible();

  const cambios: Record<string, unknown> = {
    nombre: evento.nombre,
    aforo: evento.aforo,
    dias: evento.dias,
    lineup: evento.lineup,
    ciudad: evento.ciudad || null,
    ciudad_tier: evento.ciudad_tier,
    fecha_inicio: evento.fecha_inicio || null,
    notas: evento.notas || null,
  };

  // Solo si viene explícitamente booleano; un "true" de texto o un objeto no
  // reactivan nada.
  if (typeof cuerpo.activo === "boolean") cambios.activo = cuerpo.activo;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("eventos")
    .update(cambios)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Error al editar el evento:", error);
    return NextResponse.json(
      { error: "No se pudo guardar el evento." },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ id: data.id }, { headers: rateLimitHeaders(auth.rl) });
}

/**
 * DAR DE BAJA UN EVENTO — baja lógica, nunca borrado
 * ==================================================
 * Igual que con los usuarios: un evento borrado dejaría cotizaciones
 * hablando de algo que ya no existe. `activo = false` lo saca del cotizador
 * y conserva el historial comercial.
 */
export async function DELETE(request: Request, { params }: Contexto) {
  const { id } = await params;

  const auth = await autorizarPeticion(
    request,
    "events.delete",
    LIMITES.catalogoEventos,
    {
      sinSesion: "Inicia sesión para dar de baja eventos.",
      sinPermiso: "Tu rol no permite dar de baja eventos.",
    },
  );
  if (!auth.ok) return auth.response;

  if (!esUUID(id)) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  if (!adminClientDisponible()) return catalogoNoDisponible();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("eventos")
    .update({ activo: false })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Error al dar de baja el evento:", error);
    return NextResponse.json(
      { error: "No se pudo dar de baja el evento." },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ id: data.id }, { headers: rateLimitHeaders(auth.rl) });
}
