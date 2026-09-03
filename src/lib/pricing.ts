import type { Activacion, CiudadTier, Lineup } from "./types";

/**
 * Bases por tipo de activación.
 *
 * `naming` se recalibró de $2,000,000 a $1,650,000 (2026-08-30) contra el
 * caso B2: 45,000 pers · 3 días · line-up A · CDMX · naming · exclusiva ·
 * 10x10. Con la base vieja daba $20.6M; Nicolás fijó el precio correcto en
 * $17M, y esa base lo reproduce ($17,027,010, +0.2%).
 *
 * Contexto de cómo se llegó al número, porque importa para el siguiente
 * que lo revise: Nicolás cotizó B2 primero en $6.5M, se le mostró que la
 * fórmula daba $20.6M, y entonces lo subió a $17M. O sea que el número
 * salió DESPUÉS de ver el de la fórmula — no es un precio observado en
 * frío, y menos aún un deal cerrado. Vale menos como evidencia que Ultra
 * México ($5M, deal real cerrado). Se aplica porque él es quien conoce el
 * mercado, pero queda anotado como lo que es.
 *
 * Con esta base, naming vale 2.06x lo que oficial. Sigue sin resolverse
 * qué territorio tenían los deals históricos — ver DECISIONS.md.
 */
export const BASE_ACTIVACION: Record<Activacion, number> = {
  naming: 1_650_000,
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

/**
 * Factor de territorio — calibrado con precios reales de Nicolás
 * (sesión 2026-08-30), sobre un mismo evento variando SOLO el espacio:
 * 15,000 personas · 2 días · line-up B · CDMX · oficial · con exclusividad.
 *
 *   2x2  -> $400,000     5x5  -> $1,200,000
 *   10x10 -> $2,000,000  15x15 -> $3,200,000
 *
 * Dos hallazgos de esos números:
 *
 * 1. El precio por m² se desploma (100K -> 14K), pero el precio por METRO
 *    LINEAL de lado se mantiene casi constante (~200-240K). Es decir: la
 *    intuición comercial cobra por FRENTE/visibilidad, no por superficie.
 *    Por eso el factor se ancla al LADO en metros, no al área.
 *
 * 2. El 5x5 sale en 1.00 — o sea, el 5x5 ya era el estándar implícito de
 *    la fórmula anterior (que sin territorio daba $1,190,250 para ese
 *    evento, contra los $1,200,000 que él cotiza para 5x5). Anclarlo ahí
 *    hace que agregar territorio NO recalibre nada de lo ya validado.
 *
 * Entre anclas se interpola linealmente; fuera del rango se extrapola con
 * la pendiente del tramo extremo. Se usan las anclas reales en vez de
 * ajustar una curva porque son datos suyos, no una función inventada.
 */
export const TERRITORIO_ANCLAS: { lado: number; factor: number }[] = [
  { lado: 2, factor: 0.34 },
  { lado: 5, factor: 1.0 },
  { lado: 10, factor: 1.68 },
  { lado: 15, factor: 2.69 },
];

export const TERRITORIO_LADO_MIN = 1;
export const TERRITORIO_LADO_MAX = 30;

/** Factor multiplicador según el lado (en metros) del espacio de activación. */
export function territorioFactor(lado: number): number {
  const anclas = TERRITORIO_ANCLAS;
  const pendiente = (a: number, b: number) =>
    (anclas[b].factor - anclas[a].factor) / (anclas[b].lado - anclas[a].lado);

  if (lado <= anclas[0].lado) {
    // Por debajo de 2x2: extrapola con la pendiente del primer tramo,
    // con piso para que un stand diminuto nunca haga el precio ~0.
    return Math.max(0.15, anclas[0].factor + (lado - anclas[0].lado) * pendiente(0, 1));
  }
  for (let i = 0; i < anclas.length - 1; i++) {
    if (lado <= anclas[i + 1].lado) {
      const t = (lado - anclas[i].lado) / (anclas[i + 1].lado - anclas[i].lado);
      return anclas[i].factor + t * (anclas[i + 1].factor - anclas[i].factor);
    }
  }
  // Arriba de 15x15: extrapola con la pendiente del último tramo.
  const ultimo = anclas.length - 1;
  return (
    anclas[ultimo].factor + (lado - anclas[ultimo].lado) * pendiente(ultimo - 1, ultimo)
  );
}

export interface ComputePriceInput {
  activacion: Activacion;
  aforo: number;
  dias: number;
  lineup: Lineup;
  exclusiva: boolean;
  ciudad_tier: CiudadTier;
  /** Lado en metros del espacio de activación (2 = 2x2). Default 5x5. */
  territorio_lado?: number;
}

export interface PriceFactors {
  aforo: number;
  duracion: number;
  lineup: number;
  exclusividad: number;
  ciudad: number;
  territorio: number;
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
  territorio_lado = 5,
}: ComputePriceInput): ComputePriceResult {
  const base = BASE_ACTIVACION[activacion];

  const factors: PriceFactors = {
    aforo: clamp(aforo / 20000, AFORO_FACTOR_MIN, AFORO_FACTOR_MAX),
    duracion: 1 + (dias - 1) * 0.15,
    lineup: LINEUP_FACTOR[lineup],
    exclusividad: exclusiva ? 1.25 : 1.0,
    ciudad: CIUDAD_FACTOR[ciudad_tier],
    territorio: territorioFactor(territorio_lado),
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
