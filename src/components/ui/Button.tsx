import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Jerarquía de acción del design system. Una sola primaria por vista.
 *  - primary   : la acción que el usuario vino a hacer (ámbar sólido)
 *  - secondary : alternativa legítima (contorno)
 *  - ghost     : acción terciaria / de fila / de barra de herramientas
 *  - danger    : destructiva; siempre requiere confirmación aparte
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-fg font-semibold hover:bg-primary-hover active:brightness-95",
  secondary:
    "border border-line bg-surface text-fg hover:border-line-strong hover:bg-raised",
  ghost: "text-fg-muted hover:bg-raised hover:text-fg",
  danger:
    "border border-danger/65 bg-danger/12 text-danger hover:bg-danger/20 hover:border-danger",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-control-sm px-2.5 text-xs gap-1.5",
  md: "h-control px-3.5 text-sm gap-2",
  lg: "h-control-lg px-4 text-sm gap-2",
};

/** Clases de un control con apariencia de botón. Compartidas con LinkButton. */
export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  block = false,
): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-md whitespace-nowrap",
    "transition-colors duration-150 ease-out",
    "disabled:pointer-events-none disabled:opacity-45",
    VARIANTS[variant],
    SIZES[size],
    block && "w-full",
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icono a la izquierda del texto. */
  icon?: IconName;
  /** Ocupa todo el ancho disponible. */
  block?: boolean;
  /** Muestra estado de carga y deshabilita. El texto lo decide quien llama. */
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  block = false,
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      // `type` explícito: sin él un botón dentro de <form> envía el formulario
      // por accidente. Quien necesite submit lo pasa como prop.
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClass(variant, size, block), className)}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />
      )}
      {children}
    </button>
  );
}
