import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { EventoInput } from "@/lib/types";
import type { ComputePriceResult } from "@/lib/pricing";

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

interface NarrativaBody {
  evento: EventoInput;
  precio: Pick<ComputePriceResult, "min" | "objetivo" | "max">;
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
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY no está configurada en el servidor." },
      { status: 501 },
    );
  }

  let body: NarrativaBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { evento, precio } = body;
  if (!evento || !precio) {
    return NextResponse.json({ error: "Faltan evento o precio." }, { status: 400 });
  }

  // Comparables desde Supabase (lectura pública, RLS permite select sin auth).
  // Si Supabase todavía no está conectado (Commit 2 pendiente), seguimos sin
  // comparables en vez de tronar la narrativa completa.
  let comparables: Comparable[] = [];
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.from("comparables").select("*").limit(3);
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
