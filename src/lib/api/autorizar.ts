import "server-only";

import { NextResponse } from "next/server";
import { AuthorizationError, requirePermission } from "@/lib/auth/session";
import type { AuthzContext } from "@/lib/auth/can";
import type { Permission } from "@/lib/auth/permissions";
import {
  LIMITES,
  checkRateLimit,
  identificarSolicitante,
  rateLimitHeaders,
  type RateLimitResult,
} from "@/lib/rateLimit";

/**
 * PUERTA DE ENTRADA DE UN ENDPOINT
 * ================================
 * Siempre en este orden, que no es arbitrario:
 *
 *   1. Límite por IP ANTES de tocar la sesión. Comprobar autenticación ya
 *      cuesta una llamada a Supabase; sin este paso un anónimo puede
 *      inundar ese camino sin credenciales.
 *   2. Permiso. Esta es la comprobación que cuenta: esconder el botón en el
 *      frontend no es seguridad, cualquiera puede llamar la URL directo.
 *   3. Límite por usuario, ya identificado.
 *
 * Existe para que agregar un endpoint no signifique volver a escribir —y
 * poder equivocarse en— esas tres cosas. Los endpoints anteriores
 * (`/api/cotizaciones`, `/api/narrativa`) tienen la secuencia escrita a
 * mano; pueden migrar aquí cuando se toquen por otro motivo.
 */
export type ResultadoAutorizacion =
  | { ok: true; ctx: AuthzContext; rl: RateLimitResult }
  | { ok: false; response: NextResponse };

export async function autorizarPeticion(
  request: Request,
  permiso: Permission,
  presupuesto: { limite: number; ventanaMs: number },
  mensajes: { sinSesion: string; sinPermiso: string },
): Promise<ResultadoAutorizacion> {
  const rlIp = checkRateLimit(
    `pre:${identificarSolicitante(request, null)}`,
    LIMITES.preAuth.limite,
    LIMITES.preAuth.ventanaMs,
  );
  if (!rlIp.permitido) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Demasiadas solicitudes. Espera un momento." },
        { status: 429, headers: rateLimitHeaders(rlIp) },
      ),
    };
  }

  let ctx: AuthzContext;
  try {
    ctx = await requirePermission(permiso);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: err.status === 401 ? mensajes.sinSesion : mensajes.sinPermiso,
          },
          { status: err.status },
        ),
      };
    }
    throw err;
  }

  const rl = checkRateLimit(
    identificarSolicitante(request, ctx.userId),
    presupuesto.limite,
    presupuesto.ventanaMs,
  );
  if (!rl.permitido) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Demasiadas solicitudes seguidas. Espera un momento." },
        { status: 429, headers: rateLimitHeaders(rl) },
      ),
    };
  }

  return { ok: true, ctx, rl };
}

/** Un id que no es UUID nunca debe llegar a una consulta. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUUID(valor: string): boolean {
  return UUID.test(valor);
}
