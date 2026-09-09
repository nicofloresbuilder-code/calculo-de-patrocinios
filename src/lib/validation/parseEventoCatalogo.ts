import {
  CIUDAD_TIER_OPTIONS,
  LINEUP_OPTIONS,
  type EventoCatalogoInput,
} from "../types.ts";
import {
  validateEventoCatalogo,
  type EventoCatalogoErrors,
} from "../validateEventoCatalogo.ts";

/**
 * ENTRADA NO CONFIABLE — CATÁLOGO DE EVENTOS
 * ==========================================
 * Mismo criterio que `parseEventoInput`: el cuerpo de una petición HTTP no
 * garantiza nada, aunque el tipo de TypeScript diga lo contrario (los tipos
 * se borran al compilar).
 *
 * La allowlist es lo que importa aquí. Sin ella, un `activo: true`, un
 * `creado_por` ajeno o un `id` elegido por el cliente entrarían al insert
 * solo por venir en el JSON. Se arma un objeto nuevo; nunca se hace spread
 * de lo que llegó.
 */

/** Allowlist explícita: solo estas llaves cruzan del cliente al servidor. */
const CAMPOS_PERMITIDOS = [
  "nombre",
  "aforo",
  "dias",
  "lineup",
  "ciudad",
  "ciudad_tier",
  "fecha_inicio",
  "notas",
] as const;

const LINEUP_VALUES = LINEUP_OPTIONS.map((o) => o.value);
const CIUDAD_VALUES = CIUDAD_TIER_OPTIONS.map((o) => o.value);

function esObjetoPlano(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function aNumero(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function aTexto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function aEnum<T extends string>(v: unknown, permitidos: readonly T[]): T | null {
  return typeof v === "string" && (permitidos as readonly string[]).includes(v)
    ? (v as T)
    : null;
}

export type ParseEventoCatalogoResult =
  | { ok: true; evento: EventoCatalogoInput }
  | { ok: false; errores: EventoCatalogoErrors & { _forma?: string } };

export function parseEventoCatalogo(raw: unknown): ParseEventoCatalogoResult {
  if (!esObjetoPlano(raw)) {
    return { ok: false, errores: { _forma: "El evento debe ser un objeto." } };
  }

  const lineup = aEnum(raw.lineup, LINEUP_VALUES);
  const ciudad_tier = aEnum(raw.ciudad_tier, CIUDAD_VALUES);

  const errores: EventoCatalogoErrors & { _forma?: string } = {};
  if (!lineup) errores.lineup = "Selecciona un calibre de line-up válido.";
  if (!ciudad_tier) errores.ciudad_tier = "Selecciona una ciudad/tier válida.";
  if (!lineup || !ciudad_tier) return { ok: false, errores };

  const candidato: EventoCatalogoInput = {
    nombre: aTexto(raw.nombre),
    aforo: aNumero(raw.aforo),
    dias: aNumero(raw.dias),
    lineup,
    ciudad: aTexto(raw.ciudad),
    ciudad_tier,
    fecha_inicio: aTexto(raw.fecha_inicio),
    notas: aTexto(raw.notas),
  };

  // NaN llegaría a la validación y fallaría, pero con un mensaje confuso.
  for (const campo of ["aforo", "dias"] as const) {
    if (Number.isNaN(candidato[campo])) {
      errores[campo] = "Debe ser un número.";
      candidato[campo] = 0;
    }
  }

  const erroresNegocio = validateEventoCatalogo(candidato);
  const todos = { ...errores, ...erroresNegocio };
  if (Object.keys(todos).length > 0) return { ok: false, errores: todos };

  return { ok: true, evento: candidato };
}

export { CAMPOS_PERMITIDOS as CAMPOS_EVENTO_CATALOGO };
