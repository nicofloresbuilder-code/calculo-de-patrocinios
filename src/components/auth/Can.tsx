"use client";

import type { ReactNode } from "react";
import type { Permission } from "@/lib/auth/permissions";
import { usePermissions } from "./AuthzProvider";

/**
 * Renderiza `children` solo si el usuario tiene el permiso.
 *
 *   <Can permission="users.create"><Button …/></Can>
 *
 * RECORDATORIO: esto es presentación, no seguridad. El endpoint o la Server
 * Action que ejecuta la operación tiene que volver a verificar con
 * `requirePermission()`. Un usuario puede llamar la API directamente sin
 * pasar nunca por este componente.
 */
export function Can({
  permission,
  anyOf,
  fallback = null,
  children,
}: {
  permission?: Permission;
  /** Alternativa a `permission`: basta con tener uno de estos. */
  anyOf?: readonly Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can, canAny } = usePermissions();
  const allowed = permission ? can(permission) : anyOf ? canAny(anyOf) : true;
  return <>{allowed ? children : fallback}</>;
}
