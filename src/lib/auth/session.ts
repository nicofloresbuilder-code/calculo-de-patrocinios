import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/cookieOptions";
import type { Permission } from "./permissions";
import { ANONYMOUS, can, type AuthzContext } from "./can";
import {
  resolveAuthzContext,
  rolesDeAsignaciones,
  esUserStatus,
  type AsignacionRol,
} from "./resolveContext";

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
 * Nació para resolver el huevo y la gallina —el primer SUPER_ADMIN antes de
 * que existiera la tabla de usuarios— y ahora que los roles salen de
 * `perfiles`/`usuario_roles` se queda como VÁLVULA DE SEGURIDAD: si la base
 * se queda sin ningún administrador activo (alguien se desactiva a sí mismo,
 * una migración a medias), esto es lo único que permite volver a entrar.
 *
 * Vaciarla es una decisión legítima, pero deja el sistema sin salida de
 * emergencia. Mantener ahí un solo correo de confianza es lo prudente.
 */
function bootstrapSuperAdmins(): string[] {
  return (process.env.AFORO_SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Resuelve el contexto de autorización de la petición actual.
 *
 * De dónde sale el rol, en este orden:
 *
 *   1. **Bootstrap por correo** (`AFORO_SUPER_ADMIN_EMAILS`) → SUPER_ADMIN
 *      sin tocar la base. Es la válvula de seguridad: si `perfiles` se
 *      queda sin ningún administrador, esto es lo que permite volver a
 *      entrar y arreglarlo. Por eso va ANTES de la consulta.
 *   2. **`perfiles` + `usuario_roles`**, con la sesión del propio usuario
 *      (RLS le deja leer su perfil y sus asignaciones, nada más).
 *
 * Quien no tenga fila de perfil, no tenga ningún rol asignado, o no esté
 * ACTIVE, no recibe ningún permiso. Deny by default: la respuesta a "no sé
 * quién es" nunca es "déjalo pasar".
 */
export const getAuthzContext = cache(async (): Promise<AuthzContext> => {
  // Sin Supabase configurado por completo no hay sesión posible. Se devuelve
  // anónimo en vez de reventar: fallar cerrado, no caído.
  if (!supabaseConfigurado()) return ANONYMOUS;

  let supabase: Awaited<ReturnType<typeof createClient>>;
  let user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null =
    null;
  try {
    supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user ?? null;
  } catch {
    // Proyecto de Supabase caído o inalcanzable: tratar como anónimo.
    // Fallar cerrado, nunca abierto.
    return ANONYMOUS;
  }

  if (!user) return ANONYMOUS;

  const email = user.email?.toLowerCase() ?? null;
  const meta = user.user_metadata ?? {};
  const nombreDeMetadatos =
    typeof meta.full_name === "string"
      ? meta.full_name
      : typeof meta.name === "string"
        ? meta.name
        : null;

  // ── 1. Válvula de seguridad ──────────────────────────────────────────
  if (email && bootstrapSuperAdmins().includes(email)) {
    return resolveAuthzContext({
      userId: user.id,
      email: user.email ?? null,
      displayName: nombreDeMetadatos,
      roles: ["SUPER_ADMIN"],
      status: "ACTIVE",
    });
  }

  // ── 2. Perfil y roles reales ─────────────────────────────────────────
  try {
    const [perfilRes, rolesRes] = await Promise.all([
      supabase
        .from("perfiles")
        .select("nombre, apellido, status")
        .eq("id", user.id)
        .maybeSingle<{ nombre: string | null; apellido: string | null; status: string }>(),
      supabase
        .from("usuario_roles")
        .select("roles(nombre)")
        .eq("usuario_id", user.id)
        .returns<AsignacionRol[]>(),
    ]);

    if (perfilRes.error || rolesRes.error) {
      // No se pudo comprobar quién es: se le trata como anónimo. Nunca al
      // revés.
      console.error(
        "No se pudo resolver el perfil de autorización:",
        perfilRes.error ?? rolesRes.error,
      );
      return ANONYMOUS;
    }

    const perfil = perfilRes.data;
    if (!perfil) {
      // Autenticado en Supabase pero sin fila en `perfiles`. Pasa con
      // cuentas anteriores al trigger de alta de 0004. No se inventa un
      // rol: hay que crearle el perfil.
      console.warn("Usuario autenticado sin fila en perfiles:", user.id);
      return ANONYMOUS;
    }

    const nombreCompleto =
      [perfil.nombre, perfil.apellido].filter(Boolean).join(" ").trim() || null;

    return resolveAuthzContext({
      userId: user.id,
      email: user.email ?? null,
      displayName: nombreCompleto ?? nombreDeMetadatos,
      roles: rolesDeAsignaciones(rolesRes.data ?? []),
      // Un status que no reconocemos no es ACTIVE: es desconocido, y lo
      // desconocido no opera.
      status: esUserStatus(perfil.status) ? perfil.status : null,
    });
  } catch (err) {
    console.error("Error inesperado al resolver la autorización:", err);
    return ANONYMOUS;
  }
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
