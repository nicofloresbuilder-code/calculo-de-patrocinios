import {
  AFORO_MAX,
  CIUDAD_MAX,
  CIUDAD_TIER_OPTIONS,
  DIAS_MAX,
  EVENTO_NOMBRE_MAX,
  LINEUP_OPTIONS,
  NOTAS_MAX,
  type EventoCatalogoInput,
} from "./types.ts";

export type EventoCatalogoErrors = Partial<
  Record<keyof EventoCatalogoInput, string>
>;

const LINEUP_VALUES = new Set(LINEUP_OPTIONS.map((o) => o.value));
const CIUDAD_TIER_VALUES = new Set(CIUDAD_TIER_OPTIONS.map((o) => o.value));

function isPositiveInt(v: number) {
  return Number.isInteger(v) && v > 0;
}

/**
 * `YYYY-MM-DD` y que además exista: la expresión regular sola acepta
 * 2026-02-31. Se compara contra la fecha reconstruida.
 */
export function esFechaISOValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [y, m, d] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  return (
    fecha.getUTCFullYear() === y &&
    fecha.getUTCMonth() === m - 1 &&
    fecha.getUTCDate() === d
  );
}

/**
 * Reglas de negocio del catálogo de eventos. Función pura: se usa igual en
 * el formulario y en el servidor, así que no hay dos definiciones de "qué
 * es un evento válido" que puedan separarse con el tiempo.
 *
 * Los topes son los mismos que los de una cotización (`validateEvento`) a
 * propósito: un evento que no se puede cotizar no sirve de nada en el
 * catálogo.
 */
export function validateEventoCatalogo(
  input: EventoCatalogoInput,
): EventoCatalogoErrors {
  const errors: EventoCatalogoErrors = {};

  if (!input.nombre.trim()) {
    errors.nombre = "El nombre del evento es requerido.";
  } else if (input.nombre.trim().length > EVENTO_NOMBRE_MAX) {
    errors.nombre = `Máximo ${EVENTO_NOMBRE_MAX} caracteres.`;
  }

  if (!isPositiveInt(input.aforo)) {
    errors.aforo = "El aforo debe ser un entero positivo.";
  } else if (input.aforo > AFORO_MAX) {
    errors.aforo = `El aforo no puede superar ${AFORO_MAX.toLocaleString("es-MX")}.`;
  }

  if (!isPositiveInt(input.dias)) {
    errors.dias = "La duración debe ser un entero positivo.";
  } else if (input.dias > DIAS_MAX) {
    errors.dias = `La duración no puede superar ${DIAS_MAX} días.`;
  }

  if (!LINEUP_VALUES.has(input.lineup)) {
    errors.lineup = "Selecciona un calibre de line-up válido.";
  }

  if (!CIUDAD_TIER_VALUES.has(input.ciudad_tier)) {
    errors.ciudad_tier = "Selecciona una ciudad/tier válida.";
  }

  if (input.ciudad.trim().length > CIUDAD_MAX) {
    errors.ciudad = `Máximo ${CIUDAD_MAX} caracteres.`;
  }

  // La fecha es opcional: muchos eventos se empiezan a cotizar antes de
  // tener fecha firme. Vacía está bien; mal escrita, no.
  if (input.fecha_inicio.trim() && !esFechaISOValida(input.fecha_inicio.trim())) {
    errors.fecha_inicio = "Usa una fecha válida.";
  }

  if (input.notas.trim().length > NOTAS_MAX) {
    errors.notas = `Máximo ${NOTAS_MAX} caracteres.`;
  }

  return errors;
}

export function isEventoCatalogoValid(input: EventoCatalogoInput): boolean {
  return Object.keys(validateEventoCatalogo(input)).length === 0;
}
