import type { SVGProps } from "react";

/**
 * Set de iconos propio, en línea. Decisión deliberada: no se agrega una
 * librería de iconos (lucide, heroicons) mientras el set quepa aquí — son
 * ~15 glifos y una dependencia menos que versionar. Si el set pasa de ~30,
 * migrar a `lucide-react`, que usa la misma convención (24×24, stroke 1.5,
 * currentColor) y hace el cambio mecánico.
 *
 * Regla del design system: NUNCA emojis como iconografía.
 */
export type IconName =
  | "calculator"
  | "documents"
  | "users"
  | "settings"
  | "chevronDown"
  | "chevronRight"
  | "chevronLeft"
  | "check"
  | "close"
  | "search"
  | "plus"
  | "alert"
  | "info"
  | "warning"
  | "logout"
  | "user"
  | "sparkles"
  | "menu"
  | "inbox";

const PATHS: Record<IconName, string> = {
  calculator:
    "M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 5h8M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01",
  documents:
    "M14 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7l-4-4Zm0 0v4h4M9 13h6M9 17h4",
  users:
    "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1a4 4 0 0 0-3-3.87M16.5 4.13a4 4 0 0 1 0 7.75",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-4l-.4 2.6c-.7.3-1.4.7-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2Z",
  chevronDown: "m6 9 6 6 6-6",
  chevronRight: "m9 6 6 6-6 6",
  chevronLeft: "m15 6-6 6 6 6",
  check: "m5 13 4 4L19 7",
  close: "M18 6 6 18M6 6l12 12",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35",
  plus: "M12 5v14M5 12h14",
  alert: "M12 8v5m0 3h.01M12 3l9 16H3l9-16Z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-9v4m0-7h.01",
  warning: "M12 9v4m0 3h.01M12 3l9 16H3l9-16Z",
  logout: "M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  sparkles: "M12 3v4m0 10v4M3 12h4m10 0h4M6.3 6.3l2.4 2.4m6.6 6.6 2.4 2.4m0-11.4-2.4 2.4m-6.6 6.6-2.4 2.4",
  menu: "M4 7h16M4 12h16M4 17h16",
  inbox:
    "M4 13h4l2 3h4l2-3h4M4 13 6.5 5.5A2 2 0 0 1 8.4 4h7.2a2 2 0 0 1 1.9 1.5L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Z",
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** Tamaño en px. 16 para dentro de texto/botones, 20 para navegación. */
  size?: number;
  /** Texto para lector de pantalla. Sin él, el icono se marca decorativo. */
  label?: string;
}

export function Icon({ name, size = 16, label, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
