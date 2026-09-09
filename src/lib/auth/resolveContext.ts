import { ANONYMOUS, type AuthzContext } from "./can.ts";
import {
  ROLES,
  USER_STATUSES,
  permissionsForRoles,
  rolePrincipal,
  statusCanSignIn,
  type RoleName,
  type UserStatus,
} from "./permissions.ts";

/** Fila de `usuario_roles` con el nombre del rol embebido por PostgREST. */
export interface AsignacionRol {
  roles: { nombre: string } | { nombre: string }[] | null;
}

export function esRoleName(valor: unknown): valor is RoleName {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}

export function esUserStatus(valor: unknown): valor is UserStatus {
  return (
    typeof valor === "string" && (USER_STATUSES as readonly string[]).includes(valor)
  );
}

/**
 * Nombres de rol a partir de las filas de `usuario_roles`, descartando lo
 * que no reconozcamos.
 *
 * Un rol que exista en la base pero no en el catálogo del código NO concede
 * nada: deny by default también frente a una fila inesperada. Es lo que
 * evita que crear un rol a mano en SQL —sin tocar el código— abra accesos
 * que nadie revisó.
 */
export function rolesDeAsignaciones(
  filas: readonly AsignacionRol[],
): readonly RoleName[] {
  const nombres = filas.flatMap((fila) => {
    const rel = fila.roles;
    if (!rel) return [];
    return Array.isArray(rel) ? rel.map((r) => r.nombre) : [rel.nombre];
  });
  return [...new Set(nombres.filter(esRoleName))];
}

/**
 * Convierte un perfil en un contexto de autorización.
 *
 * Está separada de la DAL a propósito: es una función pura, así que la
 * regla más importante —**una cuenta desactivada no conserva permisos
 * aunque su cookie de sesión siga siendo criptográficamente válida**— se
 * puede probar sin base de datos ni servidor.
 *
 * Ese es el escenario real: se desactiva a alguien en el panel, pero su
 * pestaña sigue abierta con una sesión vigente. Si el estado solo se
 * comprobara al iniciar sesión, seguiría operando hasta que la cookie
 * expirara. Aquí se comprueba en CADA petición.
 *
 * DENY BY DEFAULT: cualquier entrada incompleta o inconsistente colapsa a
 * ANONYMOUS, que no tiene ningún permiso.
 */
export interface PerfilAutorizacion {
  userId: string | null;
  email: string | null;
  displayName: string | null;
  /**
   * Roles asignados. Una persona puede tener varios y sus permisos se
   * suman; lista vacía = ningún acceso.
   */
  roles: readonly RoleName[];
  status: UserStatus | null;
}

export function resolveAuthzContext(perfil: PerfilAutorizacion): AuthzContext {
  // Sin identidad no hay nada que conceder.
  if (!perfil.userId) return ANONYMOUS;

  // Sin rol asignado, la cuenta existe pero no puede hacer nada. Es el
  // estado correcto para un usuario recién creado al que todavía no se le
  // asigna rol: acceso implícito a nada.
  if (perfil.roles.length === 0) return ANONYMOUS;

  // Estado de cuenta. INVITED, INACTIVE y SUSPENDED no operan.
  if (!perfil.status || !statusCanSignIn(perfil.status)) return ANONYMOUS;

  return {
    userId: perfil.userId,
    email: perfil.email,
    displayName: perfil.displayName ?? perfil.email,
    // El rol principal es solo la etiqueta que se muestra; los accesos
    // salen de la unión de permisos de TODOS sus roles.
    role: rolePrincipal(perfil.roles),
    roles: perfil.roles,
    permissions: permissionsForRoles(perfil.roles),
  };
}
