/**
 * RATE LIMITING
 * =============
 * Ventana deslizante en memoria del proceso.
 *
 * LÍMITES REALES DE ESTE ENFOQUE — hay que decirlos, no esconderlos:
 * en Vercel cada instancia serverless tiene su propia memoria, así que el
 * límite efectivo es (límite × número de instancias activas), y se reinicia
 * en cada arranque en frío. Contra un atacante distribuido y decidido, esto
 * no alcanza.
 *
 * Aun así vale la pena: detiene el caso realista —un bucle desde un solo
 * cliente quemando la cuota de la API de Anthropic— sin agregar una
 * dependencia ni un servicio nuevo. Cuando haya Redis o Upstash, se
 * reemplaza el cuerpo de `checkRateLimit()` y nada más.
 *
 * NO bloquea permanentemente: la ventana expira sola. Un bloqueo permanente
 * convertiría el propio control en una vía de denegación de servicio contra
 * usuarios legítimos.
 */

interface Ventana {
  conteo: number;
  expiraEn: number;
}

const almacen = new Map<string, Ventana>();

// Barrido perezoso: sin esto, un identificador distinto por petición haría
// crecer el Map sin fin (fuga de memoria y vector de DoS).
const MAX_ENTRADAS = 10_000;

function limpiarSiHaceFalta(ahora: number) {
  if (almacen.size < MAX_ENTRADAS) return;
  for (const [clave, v] of almacen) {
    if (v.expiraEn <= ahora) almacen.delete(clave);
  }
  // Si aun así sigue lleno (todo vigente), se vacía: es preferible perder
  // el conteo a agotar la memoria del proceso.
  if (almacen.size >= MAX_ENTRADAS) almacen.clear();
}

export interface RateLimitResult {
  permitido: boolean;
  restantes: number;
  /** Segundos hasta que la ventana se reinicie. Va en Retry-After. */
  reintentarEn: number;
  limite: number;
}

export function checkRateLimit(
  clave: string,
  limite: number,
  ventanaMs: number,
): RateLimitResult {
  const ahora = Date.now();
  limpiarSiHaceFalta(ahora);

  const actual = almacen.get(clave);
  if (!actual || actual.expiraEn <= ahora) {
    almacen.set(clave, { conteo: 1, expiraEn: ahora + ventanaMs });
    return {
      permitido: true,
      restantes: limite - 1,
      reintentarEn: Math.ceil(ventanaMs / 1000),
      limite,
    };
  }

  actual.conteo += 1;
  const reintentarEn = Math.max(1, Math.ceil((actual.expiraEn - ahora) / 1000));
  return {
    permitido: actual.conteo <= limite,
    restantes: Math.max(0, limite - actual.conteo),
    reintentarEn,
    limite,
  };
}

/**
 * Identificador del solicitante.
 *
 * Se prefiere SIEMPRE el id de usuario cuando hay sesión: la IP es
 * compartida (oficina con NAT, VPN corporativa) y limitar por IP castigaría
 * a todo un equipo por el bucle de una sola persona.
 *
 * Para anónimos se cae a la IP. `x-forwarded-for` lo puede falsificar el
 * cliente si nada lo sanea; en Vercel el proxy lo reescribe, así que aquí es
 * confiable. En otro hosting, verificar antes de confiar en él.
 */
export function identificarSolicitante(
  request: Request,
  userId: string | null,
): string {
  if (userId) return `u:${userId}`;
  const xff = request.headers.get("x-forwarded-for");
  const ip = xff?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "desconocida";
  return `ip:${ip}`;
}

/** Cabeceras estándar para que el cliente sepa cuándo reintentar. */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(r.limite),
    "RateLimit-Remaining": String(r.restantes),
    "Retry-After": String(r.reintentarEn),
  };
}

/** Presupuestos por endpoint. Centralizados para poder auditarlos de un vistazo. */
export const LIMITES = {
  /**
   * Límite por IP ANTES de autenticar. Existe porque comprobar la sesión ya
   * cuesta: cada petición anónima dispara una llamada de auth a Supabase.
   * Sin esto, un atacante sin credenciales podía inundar ese camino.
   * Es más holgado que los de abajo porque una oficina entera puede compartir
   * IP detrás de NAT.
   */
  preAuth: { limite: 60, ventanaMs: 60_000 },
  /** Llama a un servicio de pago (Anthropic). El más ajustado. */
  narrativa: { limite: 10, ventanaMs: 60_000 },
  /** Escritura en base de datos. */
  guardarCotizacion: { limite: 20, ventanaMs: 60_000 },
  /** Intercambio de código OAuth. Protege contra fuerza bruta sobre el callback. */
  authCallback: { limite: 15, ventanaMs: 60_000 },
} as const;
