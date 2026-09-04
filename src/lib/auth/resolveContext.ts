import { ANONYMOUS, type AuthzContext } from "./can.ts";
import {
  permissionsForRole,
  statusCanSignIn,
  type RoleName,
  type UserStatus,
} from "./permissions.ts";

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
  role: RoleName | null;
  status: UserStatus | null;
}

export function resolveAuthzContext(perfil: PerfilAutorizacion): AuthzContext {
  // Sin identidad no hay nada que conceder.
  if (!perfil.userId) return ANONYMOUS;

  // Sin rol asignado, la cuenta existe pero no puede hacer nada. Es el
  // estado correcto para un usuario recién creado al que todavía no se le
  // asigna rol: acceso implícito a nada.
  if (!perfil.role) return ANONYMOUS;

  // Estado de cuenta. INVITED, INACTIVE y SUSPENDED no operan.
  if (!perfil.status || !statusCanSignIn(perfil.status)) return ANONYMOUS;

  return {
    userId: perfil.userId,
    email: perfil.email,
    displayName: perfil.displayName ?? perfil.email,
    role: perfil.role,
    permissions: permissionsForRole(perfil.role),
  };
}
