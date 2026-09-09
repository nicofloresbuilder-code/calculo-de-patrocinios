import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * Clases base de control. Compartidas por Input y Select para que ambos midan
 * y se vean igual — antes cada archivo definía su propio `inputClass`, con
 * paddings distintos.
 *
 * El borde usa `line` (3:1 contra la superficie, WCAG 1.4.11) y el fondo usa
 * `sunken`: el campo se distingue por DOS señales, no solo por el borde.
 * No hay `outline-none`: el foco lo pinta la regla global de globals.css.
 */
export const controlClass = cn(
  "h-control w-full min-w-0 rounded-md border border-line bg-sunken px-3 text-sm text-fg",
  "transition-colors duration-150 ease-out",
  "hover:border-line-strong",
  "aria-[invalid=true]:border-danger",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...rest }: InputProps) {
  return <input className={cn(controlClass, className)} {...rest} />;
}
