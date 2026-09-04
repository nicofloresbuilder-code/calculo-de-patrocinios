import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClientDisponible, createAdminClient } from "@/lib/supabase/admin";
import { AuthorizationError, requirePermission } from "@/lib/auth/session";
import { parseEventoInput } from "@/lib/validation/parseEvento";
import { computePrice } from "@/lib/pricing";
import {
  LIMITES,
  checkRateLimit,
  identificarSolicitante,
  rateLimitHeaders,
} from "@/lib/rateLimit";

export const runtime = "nodejs";

/** Tope del racional. Lo genera el LLM, pero llega por el cliente. */
const MAX_RACIONAL = 4_000;

/**
 * GUARDAR COTIZACIÓN — server-side
 * ================================
 * Antes esto era un `supabase.from("cotizaciones").insert(...)` desde el
 * navegador. RLS impedía escribir en el renglón de otro usuario, pero **no
 * impedía escribir cualquier precio**: el cliente mandaba `precio_min`,
 * `precio_objetivo`, `precio_max` y `desglose` tal cual.
 *
 * Eso rompe la propuesta de valor entera del producto. Toda la defensa del
 * número frente a la marca se apoya en que salió de una fórmula
 * determinista y auditable; si cualquiera puede guardar $9,000,000 con un
 * `curl`, lo guardado deja de ser evidencia de nada.
 *
 * Aquí el servidor **recalcula el precio** desde las variables del evento y
 * descarta cualquier cifra que venga del cliente. El cliente propone las
 * variables; el servidor decide el precio.
 */
export async function POST(request: Request) {
  // Límite por IP ANTES de tocar la sesión: comprobar autenticación ya
  // implica una llamada a Supabase, así que sin esto un anónimo podía
  // inundar ese camino sin credenciales.
  const rlIp = checkRateLimit(
    `pre:${identificarSolicitante(request, null)}`,
    LIMITES.preAuth.limite,
    LIMITES.preAuth.ventanaMs,
  );
  if (!rlIp.permitido) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espera un momento." },
      { status: 429, headers: rateLimitHeaders(rlIp) },
    );
  }

  let ctx;
  try {
    ctx = await requirePermission("quotes.create");
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        {
          error:
            err.status === 401
              ? "Inicia sesión para guardar la cotización."
              : "Tu rol no permite guardar cotizaciones.",
        },
        { status: err.status },
      );
    }
    throw err;
  }

  const rl = checkRateLimit(
    identificarSolicitante(request, ctx.userId),
    LIMITES.guardarCotizacion.limite,
    LIMITES.guardarCotizacion.ventanaMs,
  );
  if (!rl.permitido) {
    return NextResponse.json(
      { error: "Demasiadas cotizaciones seguidas. Espera un momento." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const cuerpo = (body ?? {}) as Record<string, unknown>;

  // El parser aplica la allowlist: solo las variables del evento cruzan.
  // `user_id`, `precio_*`, `desglose` y cualquier otro campo que venga en el
  // cuerpo se descartan por construcción.
  const parsed = parseEventoInput(cuerpo.evento);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Las variables del evento no son válidas.", detalles: parsed.errores },
      { status: 422 },
    );
  }
  const evento = parsed.evento;

  // ── El precio lo decide el servidor, siempre ──────────────────────────
  const precio = computePrice(evento);

  // El racional sí viene del cliente (se lo dio /api/narrativa). Se acota y
  // se guarda como texto plano; nunca se renderiza como HTML.
  const racional =
    typeof cuerpo.racional === "string" && cuerpo.racional.trim() !== ""
      ? cuerpo.racional.slice(0, MAX_RACIONAL)
      : null;

  // Escritura con la llave de servicio cuando está configurada.
  //
  // Por qué: la migración 0005 revoca el INSERT directo sobre `cotizaciones`
  // desde el navegador. Sin eso, arreglar solo este endpoint sería
  // cosmético — el usuario podría seguir metiendo el precio que quisiera
  // pegándole a la REST API de Supabase con su propia sesión.
  //
  // El salto de RLS es aceptable aquí porque, en este punto, el servidor ya
  // verificó sesión (`requireAuth`), permiso (`quotes.create`), y recalculó
  // el precio: hace exactamente la comprobación que RLS haría, y además la
  // que RLS no puede hacer.
  //
  // Si la llave no está configurada, se usa el cliente de sesión y RLS sigue
  // aplicando. El precio se recalcula igual en ambos caminos: el endpoint no
  // se debilita, solo cambia quién impide el atajo por la REST API.
  const supabase = adminClientDisponible()
    ? createAdminClient()
    : await createClient();

  // `user_id` sale de la sesión del servidor, NUNCA del cuerpo de la
  // petición.
  const { data, error } = await supabase
    .from("cotizaciones")
    .insert({
      user_id: ctx.userId,
      nombre_evento: evento.nombre_evento,
      aforo: evento.aforo,
      dias: evento.dias,
      lineup: evento.lineup,
      exclusiva: evento.exclusiva,
      activacion: evento.activacion,
      ciudad_tier: evento.ciudad_tier,
      territorio_lado: evento.territorio_lado,
      paga_con_producto: evento.paga_con_producto,
      monto_producto: evento.paga_con_producto ? evento.monto_producto : null,
      precio_min: precio.min,
      precio_objetivo: precio.objetivo,
      precio_max: precio.max,
      desglose: precio.desglose,
      racional,
    })
    .select("id")
    .single();

  if (error) {
    // El detalle técnico se queda en el servidor: los mensajes de Postgres
    // revelan nombres de tabla, columnas y políticas.
    console.error("Error al guardar la cotización:", error);
    return NextResponse.json(
      { error: "No se pudo guardar la cotización." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      id: data.id,
      // Se devuelve el precio que el servidor calculó, para que el cliente
      // pueda detectar si lo que mostró difiere de lo que quedó guardado.
      precio: { min: precio.min, objetivo: precio.objetivo, max: precio.max },
    },
    { status: 201, headers: rateLimitHeaders(rl) },
  );
}
