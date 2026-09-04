import type { ReactNode } from "react";
import { cn } from "./cn";

export interface CardProps {
  /** Encabezado en versalitas. Omitirlo para una card sin título. */
  title?: string;
  /** Contenido alineado a la derecha del título (acciones, contadores). */
  actions?: ReactNode;
  /** Texto de apoyo bajo el título. */
  description?: string;
  /** Sin padding interno — para cards que contienen una tabla a sangre. */
  flush?: boolean;
  /** Superficie elevada, para contenido que debe destacar del resto. */
  raised?: boolean;
  className?: string;
  children: ReactNode;
}

/** Contenedor de sección. Reemplaza al antiguo `Panel`. */
export function Card({
  title,
  actions,
  description,
  flush = false,
  raised = false,
  className,
  children,
}: CardProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-line-subtle",
        raised ? "bg-raised shadow-md" : "bg-surface",
        className,
      )}
    >
      {(title || actions) && (
        <header
          className={cn(
            "flex items-center justify-between gap-4 px-5 py-3.5",
            !flush && "border-b border-line-subtle",
          )}
        >
          <div className="min-w-0">
            {title && <CardTitle>{title}</CardTitle>}
            {description && (
              <p className="mt-1 text-xs text-fg-subtle">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && "p-5")}>{children}</div>
    </section>
  );
}

/**
 * Overline de sección. Existe como componente porque este string exacto
 * estaba copiado en 5 lugares distintos antes del design system.
 */
export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-2xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">
      {children}
    </h2>
  );
}
