"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  ANONYMOUS,
  can as canPure,
  canAll as canAllPure,
  canAny as canAnyPure,
  hasRole as hasRolePure,
  type AuthzContext,
} from "@/lib/auth/can";
import type { Permission, RoleName } from "@/lib/auth/permissions";

const Ctx = createContext<AuthzContext>(ANONYMOUS);

/**
 * El contexto de autorización se calcula UNA vez en el servidor (DAL) y baja
 * al cliente por props. El cliente no lo deriva ni lo consulta por su cuenta:
 * así el árbol entero coincide con lo que el servidor va a permitir de todos
 * modos cuando llegue la petición real.
 */
export function AuthzProvider({
  value,
  children,
}: {
  value: AuthzContext;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuthz(): AuthzContext {
  return useContext(Ctx);
}

/**
 * Hook de permisos. Reemplaza a repartir condiciones por toda la app:
 *
 *   const { can } = usePermissions();
 *   {can("users.create") && <Button …/>}
 */
export function usePermissions() {
  const ctx = useContext(Ctx);
  return {
    ctx,
    can: (permission: Permission) => canPure(ctx, permission),
    canAny: (permissions: readonly Permission[]) => canAnyPure(ctx, permissions),
    canAll: (permissions: readonly Permission[]) => canAllPure(ctx, permissions),
    hasRole: (...roles: readonly RoleName[]) => hasRolePure(ctx, ...roles),
    isAuthenticated: ctx.userId !== null,
  };
}
