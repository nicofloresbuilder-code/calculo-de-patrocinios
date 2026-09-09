import type { Permission, RoleName } from "./permissions";

/**
 * Contexto de autorización del usuario actual. Es lo único que necesitan
 * tanto el servidor como el cliente para decidir qué se puede hacer.
 *
 * Se calcula UNA vez en el servidor (ver `session.ts`) y se pasa al árbol de
 * React. El cliente nunca lo deriva por su cuenta.
 */
export interface AuthzContext {
  userId: string | null;
  email: string | null;
  displayName: string | null;
  /**
   * Rol de mayor alcance, SOLO para presentación (la etiqueta junto al
   * nombre). Nunca para decidir accesos: para eso están los permisos.
   */
  role: RoleName | null;
  /** Todos los roles asignados. `permissions` es la unión de los suyos. */
  roles: readonly RoleName[];
  permissions: readonly Permission[];
}

export const ANONYMOUS: AuthzContext = {
  userId: null,
  email: null,
  displayName: null,
  role: null,
  roles: [],
  permissions: [],
};

/** ¿El contexto tiene este permiso? Función pura — misma respuesta en ambos lados. */
export function can(ctx: AuthzContext, permission: Permission): boolean {
  return ctx.permissions.includes(permission);
}

/** ¿Tiene al menos uno? Útil para mostrar un módulo con varias entradas. */
export function canAny(ctx: AuthzContext, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => can(ctx, p));
}

/** ¿Tiene todos? */
export function canAll(ctx: AuthzContext, permissions: readonly Permission[]): boolean {
  return permissions.every((p) => can(ctx, p));
}

/**
 * Comparación por rol. Existe para casos de presentación (mostrar la etiqueta
 * del rol, ordenar), NO para decidir accesos: para eso está `can`. Si te
 * encuentras escribiendo `hasRole(ctx, "ADMIN")` para habilitar un botón,
 * lo que falta es un permiso nuevo en el catálogo.
 */
export function hasRole(ctx: AuthzContext, ...roles: readonly RoleName[]): boolean {
  return ctx.roles.some((propio) => roles.includes(propio));
}

export function isAuthenticated(ctx: AuthzContext): boolean {
  return ctx.userId !== null;
}
