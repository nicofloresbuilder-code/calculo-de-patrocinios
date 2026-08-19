export type Lineup = "A" | "B" | "C";
export type Activacion = "naming" | "oficial" | "proveedor" | "media";
export type CiudadTier = "tier1" | "tier2" | "tier3";

/** Las 7 variables de un evento — mismas llaves que la tabla `cotizaciones` en Supabase. */
export interface EventoInput {
  nombre_evento: string;
  aforo: number;
  dias: number;
  lineup: Lineup;
  exclusiva: boolean;
  activacion: Activacion;
  ciudad_tier: CiudadTier;
}

export const AFORO_MAX = 500_000;
export const DIAS_MAX = 30;

export const LINEUP_OPTIONS: { value: Lineup; label: string }[] = [
  { value: "A", label: "A · headliner internacional" },
  { value: "B", label: "B · headliner nacional" },
  { value: "C", label: "C · line-up local / emergente" },
];

export const ACTIVACION_OPTIONS: { value: Activacion; label: string }[] = [
  { value: "naming", label: "Naming rights" },
  { value: "oficial", label: "Patrocinador oficial" },
  { value: "proveedor", label: "Proveedor oficial" },
  { value: "media", label: "Media / visibilidad" },
];

export const CIUDAD_TIER_OPTIONS: { value: CiudadTier; label: string }[] = [
  { value: "tier1", label: "Tier 1 · CDMX, GDL, MTY" },
  { value: "tier2", label: "Tier 2 · capital de estado" },
  { value: "tier3", label: "Tier 3 · resto" },
];
