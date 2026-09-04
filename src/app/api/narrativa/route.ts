import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/cookieOptions";
import { AuthorizationError, requirePermission } from "@/lib/auth/session";
import { parseEventoInput } from "@/lib/validation/parseEvento";
import {
  LIMITES,
  checkRateLimit,
  identificarSolicitante,
  rateLimitHeaders,
} from "@/lib/rateLimit";
import { computePrice } from "@/lib/pricing";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Eres un analista de pricing de patrocinios para eventos en vivo en México.
Recibes las variables de un evento, el precio calculado (min/objetivo/max),
y hasta 3 comparables históricos.

Responde SOLO en JSON, sin texto fuera del JSON:
{
  "narrativa": "2-3 líneas explicando qué variables empujan el precio hacia
                arriba o abajo, en español, tono directo, sin relleno",
  "comparables_relevantes_ids": ["id1", "id2"]
}

No inventes cifras que no te dieron. No cambies el precio — solo explícalo.`;

/**
 * Claude a veces envuelve el JSON en un bloque de markdown (```json ... ```)
 * a pesar del "SOLO en JSON" del prompt. Se le quita el fence si está, y si
 * aun así hay texto alrededor, se recorta al primer {...} balanceado.
 */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return candidate.trim();
  return candidate.slice(start, end + 1);
}

interface Comparable {
  id: string;
  nombre: string;
  marca: string;
  monto_mxn: number;
  aforo: number;
  dias: number;
  lineup: string;
  exclusiva: boolean;
  activacion: string;
  ciudad_tier: string;
}

export async function POST(request: Request) {
  // Autorización del lado del servidor. Este endpoint llama a un servicio de
  // pago: sin esta comprobación, cualquiera con la URL puede gastar la cuota
  // de la API del proyecto. Que el botón esté escondido en el frontend no
  // impide un POST directo.
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
              ? "Inicia sesión para generar el racional."
              : "Tu rol no permite generar el racional.",
        },
        { status: err.status },
      );
    }
    throw err;
  }

  // Rate limit: este endpoint llama a un servicio de pago. Aun con sesión
  // válida, un bucle quemaría la cuota de la API de Anthropic del proyecto.
  const rl = checkRateLimit(
    identificarSolicitante(request, ctx.userId),
    LIMITES.narrativa.limite,
    LIMITES.narrativa.ventanaMs,
  );
  if (!rl.permitido) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes seguidas. Espera un momento." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    // Sin detalle de configuración al cliente: el nombre de la variable de
    // entorno es información del servidor.
    console.error("ANTHROPIC_API_KEY no está configurada en el servidor.");
    return NextResponse.json(
      { error: "El racional con IA no está disponible en este ambiente." },
      { status: 501 },
    );
  }

  // El cuerpo llega sin garantías de forma: `unknown` hasta validarlo.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  // Entrada no confiable: se valida y se normaliza antes de tocarla. Antes
  // se asumía la forma por el tipo de TypeScript, que no existe en runtime.
  const parsed = parseEventoInput((body as { evento?: unknown }).evento);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Las variables del evento no son válidas.", detalles: parsed.errores },
      { status: 422 },
    );
  }
  const evento = parsed.evento;

  // El precio NO se toma del cuerpo: se recalcula. Si se aceptara el del
  // cliente, se podría hacer que la IA redacte un racional que justifique
  // cualquier cifra inventada.
  const p = computePrice(evento);
  const precio = { min: p.min, objetivo: p.objetivo, max: p.max };

  // Comparables desde Supabase (lectura pública, RLS permite select sin auth).
  // Si Supabase todavía no está conectado (Commit 2 pendiente), seguimos sin
  // comparables en vez de tronar la narrativa completa.
  let comparables: Comparable[] = [];
  if (supabaseConfigurado()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.from("comparables")
        .select("id, nombre, marca, monto_mxn, aforo, dias, lineup, exclusiva, activacion, ciudad_tier")
        .limit(3);
      comparables = data ?? [];
    } catch {
      comparables = [];
    }
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userMessage = JSON.stringify({
    evento,
    precio,
    comparables: comparables.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      marca: c.marca,
      monto_mxn: c.monto_mxn,
      aforo: c.aforo,
      dias: c.dias,
      lineup: c.lineup,
      exclusiva: c.exclusiva,
      activacion: c.activacion,
      ciudad_tier: c.ciudad_tier,
    })),
  });

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Respuesta vacía del LLM." }, { status: 502 });
    }

    const parsed = JSON.parse(extractJson(textBlock.text)) as {
      narrativa: string;
      comparables_relevantes_ids: string[];
    };

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Error llamando a Anthropic:", err);
    return NextResponse.json(
      { error: "No se pudo generar la narrativa." },
      { status: 502 },
    );
  }
}
