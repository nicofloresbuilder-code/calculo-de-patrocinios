"use client";

import { useId, type ReactNode } from "react";
import { cn } from "./cn";

export interface FieldRenderProps {
  id: string;
  "aria-invalid": boolean | undefined;
  "aria-describedby": string | undefined;
}

export interface FieldProps {
  label: string;
  /** Texto de ayuda permanente bajo el control. */
  hint?: string;
  /** Mensaje de error. Su presencia marca el control como inválido. */
  error?: string;
  /** Sufijo a la derecha del control (unidades, cálculo derivado). */
  suffix?: ReactNode;
  className?: string;
  /**
   * El control recibe id + wiring de ARIA ya resuelto. Esto es lo que evita
   * que cada formulario tenga que acordarse de `aria-describedby` — antes no
   * lo hacía ninguno.
   */
  children: (props: FieldRenderProps) => ReactNode;
}

export function Field({ label, hint, error, suffix, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-fg-muted">
        {label}
      </label>
      <div className={cn(suffix ? "flex items-center gap-2" : undefined)}>
        {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
        {suffix && (
          <span className="shrink-0 whitespace-nowrap text-xs text-fg-subtle">{suffix}</span>
        )}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-fg-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}
