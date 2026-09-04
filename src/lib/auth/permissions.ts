/**
 * CATÁLOGO DE PERMISOS Y ROLES — fuente de verdad compartida
 * ==========================================================
 *
 * Un permiso es siempre `recurso.acción`. El código de la aplicación NUNCA
 * pregunta por el nombre de un rol para decidir si algo se puede hacer;
 * pregunta por un permiso. Los roles son solo agrupaciones de permisos.
 *
 * Esa es la diferencia entre esto y un `role === "admin"`: agregar un rol
 * nuevo (o mover un permiso de un rol a otro) no obliga a tocar ni una
 * condición en la UI ni en los endpoints.
 *
 * MIGRACIÓN A BASE DE DATOS
 * -------------------------
 * Estas constantes son el *seed* del modelo relacional que viene después
 * (`roles`, `permissions`, `role_permissions`). Cuando esas tablas existan,
 * `ROLE_PERMISSIONS` deja de ser la fuente de verdad y pasa a ser el seed de
 * la migración; el tipo `Permission` se queda porque es lo que da el
 * autocompletado y el error de compilación al escribir mal un permiso.
 */

export const PERMISSIONS = [
  // Cotizador — el módulo que ya existe
  "quotes.view",
  "quotes.create",
  "quotes.edit",
  "quotes.delete",
  "quotes.view_all", // ver las cotizaciones de todo el equipo, no solo las propias

  // Administración de usuarios
  "users.view",
  "users.create",
  "users.edit",
  "users.delete",
  "users.assign_role",

  // Catálogo de comparables (la base con la que se calibra el precio)
  "comparables.view",
  "comparables.create",
  "comparables.edit",
  "comparables.delete",

  // Reportes
  "reports.view",
  "reports.export",

  // Configuración de la plataforma
  "settings.view",
  "settings.edit",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Roles iniciales. La lista puede crecer sin tocar lógica: lo único que un
 * rol nuevo necesita es una entrada aquí (y, después de la migración, una
 * fila en `roles` + sus `role_permissions`).
 */
export const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "COMMERCIAL",
  "OPERATIONS",
  "VIEWER",
] as const;

export type RoleName = (typeof ROLES)[number];

export const ROLE_LABELS: Record<RoleName, string> = {
  SUPER_ADMIN: "Super administrador",
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  COMMERCIAL: "Comercial",
  OPERATIONS: "Operaciones",
  VIEWER: "Solo lectura",
};

export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  SUPER_ADMIN: "Control total de la plataforma, incluida la configuración.",
  ADMIN: "Administra usuarios y catálogos. No cambia la configuración global.",
  MANAGER: "Ve las cotizaciones de todo el equipo y exporta reportes.",
  COMMERCIAL: "Crea y edita sus propias cotizaciones.",
  OPERATIONS: "Mantiene el catálogo de comparables.",
  VIEWER: "Solo consulta.",
};

const ALL: readonly Permission[] = PERMISSIONS;

/** Mapa rol → permisos. Seed del futuro `role_permissions`. */
export const ROLE_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
  SUPER_ADMIN: ALL,
  ADMIN: [
    "quotes.view",
    "quotes.create",
    "quotes.edit",
    "quotes.delete",
    "quotes.view_all",
    "users.view",
    "users.create",
    "users.edit",
    "users.delete",
    "users.assign_role",
    "comparables.view",
    "comparables.create",
    "comparables.edit",
    "comparables.delete",
    "reports.view",
    "reports.export",
    "settings.view",
  ],
  MANAGER: [
    "quotes.view",
    "quotes.create",
    "quotes.edit",
    "quotes.view_all",
    "users.view",
    "comparables.view",
    "reports.view",
    "reports.export",
  ],
  COMMERCIAL: ["quotes.view", "quotes.create", "quotes.edit", "comparables.view"],
  OPERATIONS: [
    "quotes.view",
    "comparables.view",
    "comparables.create",
    "comparables.edit",
    "comparables.delete",
  ],
  VIEWER: ["quotes.view", "comparables.view", "reports.view"],
};

/** Estados posibles de una cuenta. */
export const USER_STATUSES = ["ACTIVE", "INACTIVE", "INVITED", "SUSPENDED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  INVITED: "Invitado",
  SUSPENDED: "Suspendido",
};

/**
 * Solo ACTIVE puede operar. INVITED todavía no estableció contraseña;
 * INACTIVE y SUSPENDED conservan su historial pero no entran — por eso se
 * desactiva en vez de borrar.
 */
export function statusCanSignIn(status: UserStatus): boolean {
  return status === "ACTIVE";
}

export function permissionsForRole(role: RoleName): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
