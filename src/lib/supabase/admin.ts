import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * CLIENTE ADMINISTRATIVO (service_role) — SOLO SERVIDOR
 * =====================================================
 * La `SUPABASE_SERVICE_ROLE_KEY` **ignora Row Level Security por completo**.
 * Es la llave más peligrosa del proyecto.
 *
 * Reglas de uso:
 *   1. `import "server-only"`: importarla desde un Client Component es un
 *      error de compilación, no un bug en producción.
 *   2. La variable NO lleva prefijo `NEXT_PUBLIC_`, así que nunca entra al
 *      bundle del navegador.
 *   3. Se usa ÚNICAMENTE después de haber autenticado y autorizado la
 *      operación con `requirePermission()`. Saltarse RLS solo es aceptable
 *      cuando el servidor ya hizo, y puede demostrar, la comprobación que
 *      RLS habría hecho.
 *   4. Nunca se le pasa un identificador que venga del cliente sin validar.
 *
 * Caso de uso actual: escribir en `cotizaciones` con un precio recalculado
 * por el servidor, después de que la migración 0005 revoque la escritura
 * directa desde el navegador.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Cliente administrativo no disponible: falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      // Este cliente no tiene usuario ni sesión: no debe persistir ni
      // refrescar nada, ni leer cookies.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/** ¿Está configurada la llave de servicio? Para decidir la ruta de escritura. */
export function adminClientDisponible(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
