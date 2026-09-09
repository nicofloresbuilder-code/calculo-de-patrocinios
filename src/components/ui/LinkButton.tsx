import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./Button";
import { Icon, type IconName } from "./Icon";

/**
 * Enlace con apariencia de botón. Existe para no anidar `<button>` dentro de
 * `<a>`, que es HTML inválido y confunde a los lectores de pantalla: si la
 * acción navega, el elemento debe ser un enlace.
 */
export function LinkButton({
  variant = "secondary",
  size = "md",
  block = false,
  icon,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: IconName;
}) {
  return (
    <Link className={cn(buttonClass(variant, size, block), className)} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </Link>
  );
}
