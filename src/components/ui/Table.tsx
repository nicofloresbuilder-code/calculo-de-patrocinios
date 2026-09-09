import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * Tabla de trabajo. Envuelta siempre en su propio contenedor con scroll
 * horizontal: una tabla ancha hace scroll dentro de sí misma, nunca empuja
 * la página entera.
 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-sunken">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line-subtle">{children}</tbody>;
}

export function TR({
  children,
  interactive = false,
  className,
}: {
  children: ReactNode;
  /** Marca la fila como navegable (hover perceptible). */
  interactive?: boolean;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        interactive && "transition-colors duration-150 hover:bg-raised",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Alineación a la derecha para columnas numéricas. */
  numeric?: boolean;
}

export function TH({ numeric, className, children, ...rest }: THProps) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line-subtle px-4 py-2.5 text-2xs font-semibold uppercase tracking-[0.08em] text-fg-subtle",
        numeric ? "text-right" : "text-left",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export interface TDProps extends TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

export function TD({ numeric, className, children, ...rest }: TDProps) {
  return (
    <td
      className={cn("px-4 py-3 text-fg", numeric && "text-right", className)}
      {...rest}
    >
      {children}
    </td>
  );
}
