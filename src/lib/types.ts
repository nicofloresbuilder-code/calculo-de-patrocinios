export type Lineup = "A" | "B" | "C";
export type Activacion = "naming" | "oficial" | "proveedor" | "media";
export type CiudadTier = "tier1" | "tier2" | "tier3";

/** Variables de un evento — mismas llaves que la tabla `cotizaciones` en Supabase. */
export interface EventoInput {
  /**
   * Marca a la que se le cotiza. Es DATO COMERCIAL, no variable de precio:
   * `computePrice()` no la recibe y el número no cambia por escribirla.
   * Se pide porque una cotización guardada sin destinatario no sirve para
   * buscarla después.
   */
  marca: string;
  /** Persona de contacto en la marca. Opcional: no siempre se conoce todavía. */
  contacto: string;
  nombre_evento: string;
  aforo: number;
  dias: number;
  lineup: Lineup;
  exclusiva: boolean;
  activacion: Activacion;
  ciudad_tier: CiudadTier;
  /** Lado en metros del espacio de activación (5 = 5x5 m). */
  territorio_lado: number;
  /** Si parte del deal se paga con producto que nosotros vendemos. */
  paga_con_producto: boolean;
  /** Cuánto del deal llega en producto, a valor declarado por la marca. */
  monto_producto: number;
}

export const MARCA_MAX = 120;
export const CONTACTO_MAX = 120;
export const AFORO_MAX = 500_000;
export const DIAS_MAX = 30;
export const TERRITORIO_MIN = 1;
export const TERRITORIO_MAX = 30;

/** Tamaños comunes de activación, como atajo. El campo sigue siendo libre. */
export const TERRITORIO_PRESETS = [2, 5, 10, 15] as const;

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
