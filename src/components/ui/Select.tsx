import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn";
import { controlClass } from "./Input";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string = string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: readonly SelectOption<T>[];
  /** Opción vacía inicial (para filtros: "Todos los roles"). */
  placeholder?: string;
}

export function Select<T extends string = string>({
  options,
  placeholder,
  className,
  ...rest
}: SelectProps<T>) {
  return (
    <div className="relative w-full">
      <select
        className={cn(controlClass, "appearance-none pr-9", className)}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {/* Flecha propia: el chevron nativo no se puede tematizar y en oscuro
          se ve como un artefacto del sistema operativo. */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
