import {
  ACTIVACION_OPTIONS,
  CIUDAD_TIER_OPTIONS,
  LINEUP_OPTIONS,
  type EventoInput,
} from "../types.ts";
import { validateEvento, type EventoErrors } from "../validateEvento.ts";

/**
 * VALIDACIÓN DE ENTRADA NO CONFIABLE
 * ==================================
 * `validateEvento()` asume que ya recibe un `EventoInput` bien formado — sirve
 * para el formulario, donde TypeScript garantiza la forma. Un cuerpo JSON que
 * llega por HTTP no garantiza nada: puede traer `null`, arreglos, objetos
 * anidados, números como texto, o campos de más.
 *
 * `parseEventoInput()` cierra ese hueco: normaliza tipos primero y valida
 * después, y **descarta cualquier campo que no esté en la allowlist**. Es la
 * única puerta por la que un evento entra al servidor.
 *
 * Reutiliza `validateEvento` a propósito: las reglas de negocio (topes de
 * aforo, días, territorio) viven en un solo lugar y ya tienen tests.
 */

/** Allowlist explícita: solo estas llaves cruzan del cliente al servidor. */
const CAMPOS_PERMITIDOS = [
  "evento_id",
  "marca",
  "contacto",
  "nombre_evento",
  "aforo",
  "dias",
  "lineup",
  "exclusiva",
  "activacion",
  "ciudad_tier",
  "tiene_territorio",
  "territorio_lado",
  "paga_con_producto",
  "monto_producto",
] as const;

const LINEUP_VALUES = LINEUP_OPTIONS.map((o) => o.value);
const ACTIVACION_VALUES = ACTIVACION_OPTIONS.map((o) => o.value);
const CIUDAD_VALUES = CIUDAD_TIER_OPTIONS.map((o) => o.value);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esObjetoPlano(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Number() acepta "", null y true. Aquí solo pasan números o texto numérico. */
function aNumero(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function aBooleano(v: unknown): boolean {
  return v === true || v === "true";
}

function aEnum<T extends string>(v: unknown, permitidos: readonly T[]): T | null {
  return typeof v === "string" && (permitidos as readonly string[]).includes(v)
    ? (v as T)
    : null;
}

export type ParseResult =
  | { ok: true; evento: EventoInput }
  | { ok: false; errores: EventoErrors & { _forma?: string } };

export function parseEventoInput(raw: unknown): ParseResult {
  if (!esObjetoPlano(raw)) {
    return { ok: false, errores: { _forma: "El evento debe ser un objeto." } };
  }

  // Se leen SOLO las llaves de la allowlist. Cualquier campo extra que venga
  // en el cuerpo (por ejemplo `user_id`, `precio_objetivo`, `role`) se ignora
  // por construcción: no se copia el objeto, se arma uno nuevo.
  const lineup = aEnum(raw.lineup, LINEUP_VALUES);
  const activacion = aEnum(raw.activacion, ACTIVACION_VALUES);
  const ciudad_tier = aEnum(raw.ciudad_tier, CIUDAD_VALUES);

  const errores: EventoErrors & { _forma?: string } = {};
  if (!lineup) errores.lineup = "Selecciona un calibre de line-up válido.";
  if (!activacion) errores.activacion = "Selecciona un tipo de activación válido.";
  if (!ciudad_tier) errores.ciudad_tier = "Selecciona una ciudad/tier válida.";
  if (Object.keys(errores).length > 0) return { ok: false, errores };

  // Referencia al catálogo. Lo único que se comprueba aquí es la FORMA: que
  // el evento exista, esté activo y sus datos sean los buenos lo resuelve el
  // endpoint contra la base — el cliente no es fuente de verdad de eso.
  const eventoId =
    typeof raw.evento_id === "string" && UUID.test(raw.evento_id.trim())
      ? raw.evento_id.trim()
      : "";

  const candidato: EventoInput = {
    evento_id: eventoId,
    marca: typeof raw.marca === "string" ? raw.marca.trim() : "",
    contacto: typeof raw.contacto === "string" ? raw.contacto.trim() : "",
    nombre_evento:
      typeof raw.nombre_evento === "string" ? raw.nombre_evento.trim() : "",
    aforo: aNumero(raw.aforo),
    dias: aNumero(raw.dias),
    lineup: lineup!,
    exclusiva: aBooleano(raw.exclusiva),
    activacion: activacion!,
    ciudad_tier: ciudad_tier!,
    // Ausente = true, para no romper cotizaciones viejas ni clientes que
    // todavía no mandan el campo.
    tiene_territorio: raw.tiene_territorio === undefined ? true : aBooleano(raw.tiene_territorio),
    territorio_lado: aNumero(raw.territorio_lado),
    paga_con_producto: aBooleano(raw.paga_con_producto),
    monto_producto: aBooleano(raw.paga_con_producto)
      ? aNumero(raw.monto_producto)
      : 0,
  };

  // NaN llegaría a validateEvento y fallaría sus comprobaciones numéricas,
  // pero con un mensaje confuso. Se traduce antes.
  for (const campo of ["aforo", "dias", "territorio_lado", "monto_producto"] as const) {
    if (Number.isNaN(candidato[campo])) {
      // Sin espacio físico, el lado no se usa: se normaliza sin marcar error.
      if (campo === "territorio_lado" && !candidato.tiene_territorio) {
        candidato.territorio_lado = 0;
        continue;
      }
      errores[campo] = "Debe ser un número.";
      candidato[campo] = 0;
    }
  }

  const erroresNegocio = validateEvento(candidato);
  const todos = { ...errores, ...erroresNegocio };
  if (Object.keys(todos).length > 0) return { ok: false, errores: todos };

  return { ok: true, evento: candidato };
}

export { CAMPOS_PERMITIDOS };
