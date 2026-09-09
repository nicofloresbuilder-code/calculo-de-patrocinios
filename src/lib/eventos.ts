import "server-only";

import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/cookieOptions";
import { getAuthzContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/can";
import type { EventoCatalogo } from "./types";

/**
 * LECTURA DEL CATÁLOGO DE EVENTOS
 * ===============================
 * Un solo lugar que responde "qué eventos puede ver esta sesión". Lo usan
 * la pantalla de administración y el cotizador; si cada una hiciera su
 * propia consulta, serían dos sitios donde olvidarse de comprobar el
 * permiso.
 *
 * Devuelve un estado en vez de lanzar: cada pantalla decide cómo se ve
 * "sin sesión" o "sin permiso" en su contexto, pero ninguna puede saltarse
 * la comprobación.
 */
export type ResultadoEventos =
  | { estado: "ok"; eventos: EventoCatalogo[] }
  | { estado: "sin-configurar" }
  | { estado: "sin-permiso" }
  | { estado: "error" };

const COLUMNAS =
  "id, nombre, aforo, dias, lineup, ciudad, ciudad_tier, fecha_inicio, notas, activo, creado_en";

interface EventoRow {
  id: string;
  nombre: string;
  aforo: number;
  dias: number;
  lineup: string;
  ciudad: string | null;
  ciudad_tier: string;
  fecha_inicio: string | null;
  notas: string | null;
  activo: boolean;
  creado_en: string;
}

/** Escapa los comodines de PostgREST para que la búsqueda sea literal. */
function patronBusqueda(termino: string): string {
  return `%${termino.replace(/[%_,()]/g, "")}%`;
}

export async function listarEventos(opciones?: {
  /** El cotizador solo ofrece eventos vigentes; la administración los ve todos. */
  soloActivos?: boolean;
  q?: string;
}): Promise<ResultadoEventos> {
  if (!supabaseConfigurado()) return { estado: "sin-configurar" };

  const ctx = await getAuthzContext();
  if (!can(ctx, "events.view")) return { estado: "sin-permiso" };

  const supabase = await createClient();
  let consulta = supabase.from("eventos").select(COLUMNAS);

  if (opciones?.soloActivos) consulta = consulta.eq("activo", true);
  if (opciones?.q) {
    consulta = consulta.ilike("nombre", patronBusqueda(opciones.q));
  }

  const { data, error } = await consulta
    .order("activo", { ascending: false })
    .order("fecha_inicio", { ascending: true, nullsFirst: false })
    .order("nombre", { ascending: true })
    .returns<EventoRow[]>();

  if (error) {
    console.error("Error al leer el catálogo de eventos:", error);
    return { estado: "error" };
  }

  return {
    estado: "ok",
    eventos: (data ?? []).map(
      (fila): EventoCatalogo => ({
        id: fila.id,
        nombre: fila.nombre,
        aforo: fila.aforo,
        dias: fila.dias,
        lineup: fila.lineup as EventoCatalogo["lineup"],
        ciudad: fila.ciudad ?? "",
        ciudad_tier: fila.ciudad_tier as EventoCatalogo["ciudad_tier"],
        fecha_inicio: fila.fecha_inicio ?? "",
        notas: fila.notas ?? "",
        activo: fila.activo,
        creado_en: fila.creado_en,
      }),
    ),
  };
}

/**
 * Un evento concreto, activo. Lo usa el guardado de cotizaciones para tomar
 * los datos del CATÁLOGO y no los que mandó el navegador: si el cliente
 * dice "evento X" pero con aforo 500,000, gana el catálogo.
 */
export async function obtenerEventoActivo(
  id: string,
): Promise<EventoCatalogo | null> {
  if (!supabaseConfigurado()) return null;

  const ctx = await getAuthzContext();
  if (!can(ctx, "events.view")) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos")
    .select(COLUMNAS)
    .eq("id", id)
    .eq("activo", true)
    .maybeSingle<EventoRow>();

  if (error) {
    console.error("Error al leer el evento:", error);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    nombre: data.nombre,
    aforo: data.aforo,
    dias: data.dias,
    lineup: data.lineup as EventoCatalogo["lineup"],
    ciudad: data.ciudad ?? "",
    ciudad_tier: data.ciudad_tier as EventoCatalogo["ciudad_tier"],
    fecha_inicio: data.fecha_inicio ?? "",
    notas: data.notas ?? "",
    activo: data.activo,
    creado_en: data.creado_en,
  };
}
