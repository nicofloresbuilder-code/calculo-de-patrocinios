import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/cookieOptions";
import type { Permission, RoleName, UserStatus } from "./permissions";
import { ANONYMOUS, can, type AuthzContext } from "./can";
import { resolveAuthzContext } from "./resolveContext";

/**
 * DATA ACCESS LAYER (DAL) — el único lugar del servidor que resuelve
 * "quién es el usuario y qué puede hacer".
 * ======================================================================
 *
 * Antes esta pregunta se hacía en 4 lugares distintos (Header, la página de
 * cotizaciones, GuardarCotizacion y la route de narrativa), cada uno con su
 * propio cliente de Supabase. Con una regla de permisos eso son 4 lugares
 * donde olvidarse de aplicarla.
 *
 * `cache()` de React memoiza el resultado durante un mismo render, así que
 * el shell, la página y cualquier componente anidado comparten una sola
 * lectura de sesión.
 *
 * IMPORTANTE — `import "server-only"` hace que importar este archivo desde
 * un Client Component sea un error de compilación, no un bug de runtime.
 */

/**
 * Bootstrap de administradores. Lista de correos separados por coma en una
 * variable de entorno SOLO de servidor (sin prefijo NEXT_PUBLIC_, así que
 * nunca llega al bundle del cliente).
 *
 * Es el mecanismo para que exista el primer SUPER_ADMIN antes de que exista
 * la tabla de usuarios — el problema clásico del huevo y la gallina. Cuando
 * la migración de `perfiles` esté aplicada, esta variable se puede vaciar y
 * el rol sale de la base de datos.
 */
function bootstrapSuperAdmins(): string[] {
  return (process.env.AFORO_SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Rol de un usuario autenticado que todavía no tiene fila de perfil.
 *
 * Hoy la tabla `perfiles` no existe (ver DESIGN-SYSTEM.md §RBAC y la
 * propuesta de migración). COMMERCIAL concede exactamente lo que la app ya
 * hacía antes de este cambio: cotizar y guardar tus propias cotizaciones.
 * No abre nada nuevo — en particular, ningún permiso `users.*`, así que el
 * módulo de administración es inalcanzable hasta que la migración exista y
 * alguien tenga un rol que lo incluya.
 */
const DEFAULT_ROLE: RoleName = "COMMERCIAL";

/**
 * Resuelve el contexto de autorización de la petición actual.
 *
 * Cuando llegue la tabla `perfiles`, el ÚNICO cambio es dentro de esta
 * función: leer el perfil, tomar `role` y `status`, y devolver ANONYMOUS si
 * el status no puede iniciar sesión. Ni una llamada a `getAuthzContext()`
 * cambia.
 */
export const getAuthzContext = cache(async (): Promise<AuthzContext> => {
  // Sin Supabase configurado por completo no hay sesión posible. Se devuelve
  // anónimo en vez de reventar: fallar cerrado, no caído.
  if (!supabaseConfigurado()) return ANONYMOUS;

  let user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null =
    null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user ?? null;
  } catch {
    // Proyecto de Supabase caído o inalcanzable: tratar como anónimo.
    // Fallar cerrado, nunca abierto.
    return ANONYMOUS;
  }

  if (!user) return ANONYMOUS;

  const email = user.email?.toLowerCase() ?? null;
  const role: RoleName =
    email && bootstrapSuperAdmins().includes(email) ? "SUPER_ADMIN" : DEFAULT_ROLE;

  const meta = user.user_metadata ?? {};
  const fullName =
    typeof meta.full_name === "string"
      ? meta.full_name
      : typeof meta.name === "string"
        ? meta.name
        : null;

  // Sin la tabla `perfiles` no hay estado que consultar todavía; un usuario
  // autenticado por Supabase se trata como ACTIVE. Cuando la migración
  // 0004_rbac.sql esté aplicada, `status` y `role` salen de `perfiles` y
  // `resolveAuthzContext` corta el acceso de las cuentas desactivadas en
  // cada petición, sin que cambie nada más.
  const status: UserStatus = "ACTIVE";

  return resolveAuthzContext({
    userId: user.id,
    email: user.email ?? null,
    displayName: fullName,
    role,
    status,
  });
});

/** Error de autorización con el status HTTP que le corresponde. */
export class AuthorizationError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Exige sesión. Para Route Handlers y Server Actions.
 * En páginas, preferir `getAuthzContext()` + `redirect()` para poder mandar
 * al usuario al login con un `next` de regreso.
 */
export async function requireAuth(): Promise<AuthzContext> {
  const ctx = await getAuthzContext();
  if (!ctx.userId) {
    throw new AuthorizationError(401, "Se requiere iniciar sesión.");
  }
  return ctx;
}

/**
 * Exige un permiso concreto. ESTA es la comprobación que cuenta: ocultar un
 * botón en el frontend no es seguridad, solo cortesía. Toda acción sensible
 * pasa por aquí, del lado del servidor, aunque el cliente ya haya escondido
 * el control.
 */
export async function requirePermission(permission: Permission): Promise<AuthzContext> {
  const ctx = await requireAuth();
  if (!can(ctx, permission)) {
    throw new AuthorizationError(403, `Permiso requerido: ${permission}`);
  }
  return ctx;
}
