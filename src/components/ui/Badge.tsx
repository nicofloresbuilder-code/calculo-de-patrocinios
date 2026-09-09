import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Tonos semánticos. La regla del design system: un tono SIEMPRE significa lo
 * mismo, en toda la app.
 *   neutral  — sin carga (INACTIVE, "sin asignar")
 *   info     — informativo, en curso (INVITED)
 *   success  — estado sano, operación completada (ACTIVE)
 *   warning  — requiere atención, todavía no es un fallo (SUSPENDED)
 *   danger   — fallo o destructivo
 *   primary  — el ámbar de marca; se reserva para "este es el número/valor
 *              que importa", nunca para un estado.
 */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "primary";

const TONES: Record<Tone, string> = {
  neutral: "border-neutral/65 bg-neutral/15 text-neutral",
  info: "border-info/65 bg-info/15 text-info",
  success: "border-success/65 bg-success/15 text-success",
  warning: "border-warning/65 bg-warning/15 text-warning",
  danger: "border-danger/65 bg-danger/15 text-danger",
  primary: "border-primary/65 bg-primary/15 text-primary",
};

export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: Tone;
  /** Punto de color al inicio: el estado se lee sin depender solo del color. */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5",
        "text-2xs font-medium uppercase tracking-wide whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
