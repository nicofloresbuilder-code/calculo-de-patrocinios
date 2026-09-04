"use client";

import { cn } from "./cn";

export interface SegmentedControlProps<T extends string | number> {
  /** Etiqueta accesible del grupo entero. */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Grupo de opciones mutuamente excluyentes (los presets de territorio).
 * Antes eran <button> sueltos: se veían como un radio group pero no lo eran
 * para un lector de pantalla. Ahora usa `role="radiogroup"` + `aria-checked`.
 */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex gap-1.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-control-sm flex-1 rounded-md border px-2 text-xs transition-colors duration-150 ease-out",
              active
                ? "border-primary bg-primary/15 font-medium text-primary"
                : "border-line-subtle bg-sunken/60 text-fg-muted hover:border-line hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
