import type { Activacion, CiudadTier, Lineup } from "./types";

export const BASE_ACTIVACION: Record<Activacion, number> = {
  naming: 2_000_000,
  oficial: 800_000,
  proveedor: 300_000,
  media: 150_000,
};

export const LINEUP_FACTOR: Record<Lineup, number> = { A: 1.4, B: 1.15, C: 1.0 };

export const CIUDAD_FACTOR: Record<CiudadTier, number> = {
  tier1: 1.2,
  tier2: 1.0,
  tier3: 0.85,
};

export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/**
 * Piso del factor de aforo. Pase mecánico (Commit 7, DECISIONS.md):
 * con el piso original de 0.3, "Match Cup" (aforo 2,000, real $300K
 * negociados) computaba $108K — 64% por debajo del real, porque
 * aforo/20000 = 0.1 se clampeaba al mismo 0.3 que cualquier evento chico,
 * sin distinguir 500 asistentes de 5,999. Subido a 0.7 con evidencia de
 * ese deal: $300K → $252K, -16% (todavía subestima, pero mucho menos).
 * Falta más de un deal chico para calibrar el piso con precisión —
 * documentado como pendiente, no resuelto con una corazonada.
 */
const AFORO_FACTOR_MIN = 0.7;
const AFORO_FACTOR_MAX = 3.0;

export interface ComputePriceInput {
  activacion: Activacion;
  aforo: number;
  dias: number;
  lineup: Lineup;
  exclusiva: boolean;
  ciudad_tier: CiudadTier;
}

export interface PriceFactors {
  aforo: number;
  duracion: number;
  lineup: number;
  exclusividad: number;
  ciudad: number;
}

export interface ComputePriceResult {
  min: number;
  objetivo: number;
  max: number;
  factors: PriceFactors;
  /** % de cuánto empuja cada variable, normalizado a 100 */
  desglose: Record<keyof PriceFactors, number>;
  base: number;
}

/**
 * Motor de pricing determinista — el precio nunca lo decide el LLM.
 * Los pesos (1.4 / 1.25 / 1.2 / etc.) siguen siendo un punto de partida
 * en su mayoría sin verificar. El piso del factor de aforo ya se
 * recalibró una vez en el pase mecánico (Commit 7, ver AFORO_FACTOR_MIN
 * arriba) contra los 3 deals reales — el resto de los pesos sigue
 * pendiente de más pases con más deals. Ver DECISIONS.md.
 */
export function computePrice({
  activacion,
  aforo,
  dias,
  lineup,
  exclusiva,
  ciudad_tier,
}: ComputePriceInput): ComputePriceResult {
  const base = BASE_ACTIVACION[activacion];

  const factors: PriceFactors = {
    aforo: clamp(aforo / 20000, AFORO_FACTOR_MIN, AFORO_FACTOR_MAX),
    duracion: 1 + (dias - 1) * 0.15,
    lineup: LINEUP_FACTOR[lineup],
    exclusividad: exclusiva ? 1.25 : 1.0,
    ciudad: CIUDAD_FACTOR[ciudad_tier],
  };

  const totalFactor = Object.values(factors).reduce((a, b) => a * b, 1);
  const objetivo = base * totalFactor;
  const min = objetivo * 0.75;
  const max = objetivo * 1.3;

  const devs = Object.entries(factors).map(
    ([k, v]) => [k, Math.abs(Math.log(v))] as const,
  );
  const totalDev = devs.reduce((s, [, d]) => s + d, 0) || 1;
  const desglose = Object.fromEntries(
    devs.map(([k, d]) => [k, Math.round((d / totalDev) * 100)]),
  ) as Record<keyof PriceFactors, number>;

  return { min, objetivo, max, factors, desglose, base };
}
