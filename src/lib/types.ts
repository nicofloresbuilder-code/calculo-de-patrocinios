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
  /**
   * Si el patrocinio incluye espacio físico de activación. Cuando es `false`
   * la marca solo tiene presencia (logo, menciones, branding) y no se le
   * cobra territorio — ver SIN_TERRITORIO_FACTOR en pricing.ts.
   */
  tiene_territorio: boolean;
  /** Lado en metros del espacio de activación (5 = 5x5 m). Se ignora si `tiene_territorio` es false. */
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

/**
 * Tamaños comunes de activación, como atajo. El campo sigue siendo libre.
 *
 * OJO: esto es solo la botonera de la UI. Las ANCLAS de calibración viven en
 * `TERRITORIO_ANCLAS` (pricing.ts) y NO cambian con esto — el ancla de 2×2
 * sigue ahí porque es un precio real que dio Nicolás. Quitar el botón de 2×2
 * no borra ese dato; un 3×3 simplemente interpola entre las anclas de 2 y 5.
 */
export const TERRITORIO_PRESETS = [3, 5, 10, 15] as const;

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
