import { NextResponse } from "next/server";
import { adminClientDisponible, createAdminClient } from "@/lib/supabase/admin";
import { autorizarPeticion } from "@/lib/api/autorizar";
import { parseEventoCatalogo } from "@/lib/validation/parseEventoCatalogo";
import { LIMITES, rateLimitHeaders } from "@/lib/rateLimit";

export const runtime = "nodejs";

/**
 * ALTA DE EVENTOS DEL CATÁLOGO
 * ============================
 * La migración 0008 revoca INSERT/UPDATE/DELETE sobre `eventos` al rol
 * `authenticated`, así que este endpoint es la única puerta de escritura.
 * Eso es a propósito: si el navegador pudiera escribir directo contra la
 * REST API de Supabase, la comprobación de `events.create` no serviría de
 * nada — bastaría con no pasar por la interfaz.
 *
 * `creado_por` sale de la sesión del servidor, nunca del cuerpo.
 */
export async function POST(request: Request) {
  const auth = await autorizarPeticion(
    request,
    "events.create",
    LIMITES.catalogoEventos,
    {
      sinSesion: "Inicia sesión para dar de alta eventos.",
      sinPermiso: "Tu rol no permite dar de alta eventos.",
    },
  );
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const cuerpo = (body ?? {}) as Record<string, unknown>;

  // La allowlist del parser descarta por construcción cualquier campo que no
  // sea del evento: `activo`, `id`, `creado_por` no cruzan.
  const parsed = parseEventoCatalogo(cuerpo.evento);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Los datos del evento no son válidos.", detalles: parsed.errores },
      { status: 422 },
    );
  }
  const evento = parsed.evento;

  if (!adminClientDisponible()) {
    // Sin la llave de servicio no hay forma de escribir: 0008 revocó el
    // INSERT del rol `authenticated`. Se dice claro en vez de fallar con un
    // error de permisos de Postgres que no explica nada.
    console.error(
      "Alta de evento sin SUPABASE_SERVICE_ROLE_KEY configurada: la escritura directa está revocada por 0008.",
    );
    return NextResponse.json(
      { error: "El catálogo no está disponible en este ambiente." },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("eventos")
    .insert({
      nombre: evento.nombre,
      aforo: evento.aforo,
      dias: evento.dias,
      lineup: evento.lineup,
      ciudad: evento.ciudad || null,
      ciudad_tier: evento.ciudad_tier,
      // Vacío se guarda como NULL: "todavía no hay fecha" es un hecho, no
      // una fecha cero.
      fecha_inicio: evento.fecha_inicio || null,
      notas: evento.notas || null,
      creado_por: auth.ctx.userId,
    })
    .select("id")
    .single();

  if (error) {
    // El detalle técnico se queda en el servidor: los mensajes de Postgres
    // revelan nombres de tabla, columnas y políticas.
    console.error("Error al crear el evento:", error);
    return NextResponse.json(
      { error: "No se pudo guardar el evento." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { id: data.id },
    { status: 201, headers: rateLimitHeaders(auth.rl) },
  );
}
