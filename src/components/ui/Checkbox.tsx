"use client";

import { useId } from "react";
import { cn } from "./cn";

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Texto de apoyo bajo la etiqueta. */
  hint?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Fila de opción booleana. Se ve como una fila accionable —no como un campo
 * de texto, que era la confusión del formulario anterior— y toda el área es
 * clickeable porque el <label> envuelve el control.
 */
export function Checkbox({
  label,
  checked,
  onCheckedChange,
  hint,
  disabled,
  className,
}: CheckboxProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("min-w-0", className)}>
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2.5",
          "border border-line-subtle bg-sunken/60 transition-colors duration-150 ease-out",
          "hover:border-line",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className="text-sm text-fg">{label}</span>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-describedby={hintId}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="size-4 shrink-0 cursor-pointer accent-primary"
        />
      </label>
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-fg-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}
