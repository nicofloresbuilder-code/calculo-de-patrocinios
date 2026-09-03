import {
  ACTIVACION_OPTIONS,
  AFORO_MAX,
  CIUDAD_TIER_OPTIONS,
  DIAS_MAX,
  LINEUP_OPTIONS,
  TERRITORIO_MAX,
  TERRITORIO_MIN,
  type EventoInput,
} from "./types";

export type EventoErrors = Partial<Record<keyof EventoInput, string>>;

const LINEUP_VALUES = new Set(LINEUP_OPTIONS.map((o) => o.value));
const ACTIVACION_VALUES = new Set(ACTIVACION_OPTIONS.map((o) => o.value));
const CIUDAD_TIER_VALUES = new Set(CIUDAD_TIER_OPTIONS.map((o) => o.value));

function isPositiveInt(v: number) {
  return Number.isInteger(v) && v > 0;
}

/**
 * Security floor #4: aforo y días son enteros positivos con tope razonable
 * (aforo max 500,000, días max 30); el resto son selects de opciones fijas,
 * no texto libre. Función pura — testeable sin UI.
 */
export function validateEvento(input: EventoInput): EventoErrors {
  const errors: EventoErrors = {};

  if (!input.nombre_evento.trim()) {
    errors.nombre_evento = "El nombre del evento es requerido.";
  } else if (input.nombre_evento.trim().length > 120) {
    errors.nombre_evento = "Máximo 120 caracteres.";
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
    errors.lineup = "Selecciona un caliber de line-up válido.";
  }

  if (!ACTIVACION_VALUES.has(input.activacion)) {
    errors.activacion = "Selecciona un tipo de activación válido.";
  }

  if (!CIUDAD_TIER_VALUES.has(input.ciudad_tier)) {
    errors.ciudad_tier = "Selecciona una ciudad/tier válida.";
  }

  if (!Number.isFinite(input.territorio_lado) || input.territorio_lado <= 0) {
    errors.territorio_lado = "El territorio debe ser mayor a 0.";
  } else if (input.territorio_lado < TERRITORIO_MIN) {
    errors.territorio_lado = `Mínimo ${TERRITORIO_MIN}×${TERRITORIO_MIN} m.`;
  } else if (input.territorio_lado > TERRITORIO_MAX) {
    errors.territorio_lado = `Máximo ${TERRITORIO_MAX}×${TERRITORIO_MAX} m.`;
  }

  if (input.paga_con_producto) {
    if (!Number.isFinite(input.monto_producto) || input.monto_producto <= 0) {
      errors.monto_producto = "Indica cuánto del deal llega en producto.";
    } else if (input.monto_producto > 1_000_000_000) {
      errors.monto_producto = "Monto fuera de rango.";
    }
  }

  return errors;
}

export function isEventoValid(input: EventoInput): boolean {
  return Object.keys(validateEvento(input)).length === 0;
}
