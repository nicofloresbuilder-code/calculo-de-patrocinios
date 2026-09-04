import type { IconName } from "@/components/ui/Icon";
import { canAny, type AuthzContext } from "./auth/can.ts";
import type { Permission } from "./auth/permissions";

/**
 * REGISTRO DE MÓDULOS
 * ===================
 * Agregar un módulo a la plataforma es agregar una entrada aquí. La barra
 * lateral, el breadcrumb y el filtrado por permisos salen todos de esta
 * lista — no hay que tocar tres archivos ni acordarse de esconder un link.
 *
 * `permissions` es la lista de permisos que dan acceso al módulo: basta con
 * tener UNO. Un item sin `permissions` es público para cualquier sesión.
 *
 * ATENCIÓN: esconder un item de aquí NO protege la ruta. Es solo la capa de
 * presentación. La ruta se protege del lado del servidor con
 * `requirePermission()` (ver src/lib/auth/session.ts).
 */
export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  permissions?: readonly Permission[];
  /** Requiere sesión iniciada aunque no exija un permiso concreto. */
  requiresAuth?: boolean;
  /** Coincidencia exacta de ruta en vez de por prefijo (útil para "/"). */
  exact?: boolean;
}

export interface NavSection {
  /** Título del grupo en la barra lateral. Omitir para el grupo principal. */
  title?: string;
  items: readonly NavItem[];
}

export const NAVIGATION: readonly NavSection[] = [
  {
    items: [
      { href: "/", label: "Cotizador", icon: "calculator", exact: true },
      {
        href: "/cotizaciones",
        label: "Cotizaciones",
        icon: "documents",
        requiresAuth: true,
        permissions: ["quotes.view"],
      },
    ],
  },
  {
    title: "Administración",
    items: [
      {
        href: "/admin/usuarios",
        label: "Usuarios",
        icon: "users",
        permissions: ["users.view"],
      },
      {
        href: "/admin/configuracion",
        label: "Configuración",
        icon: "settings",
        permissions: ["settings.view"],
      },
    ],
  },
];

export function isNavItemVisible(item: NavItem, ctx: AuthzContext): boolean {
  if (item.requiresAuth && !ctx.userId) return false;
  if (!item.permissions || item.permissions.length === 0) return true;
  return canAny(ctx, item.permissions);
}

/** Secciones con sus items ya filtrados; las que quedan vacías se descartan. */
export function visibleNavigation(ctx: AuthzContext): NavSection[] {
  return NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) => isNavItemVisible(item, ctx)),
  })).filter((section) => section.items.length > 0);
}

export function isActive(item: NavItem, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}
