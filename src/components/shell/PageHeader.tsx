import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Encabezado de página: breadcrumb → título (el <h1> real de la ruta) →
 * descripción → acciones primarias. Es el patrón que todas las pantallas de
 * la plataforma comparten, para que el usuario siempre sepa dónde está y
 * cuál es la acción principal de esta vista.
 */
export function PageHeader({
  breadcrumbs,
  title,
  description,
  actions,
}: {
  breadcrumbs?: readonly Crumb[];
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-line-subtle bg-canvas px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Ruta" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-fg-subtle">
              {breadcrumbs.map((c, i) => (
                <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <Icon name="chevronRight" size={12} className="text-line-strong" />}
                  {c.href ? (
                    <Link href={c.href} className="transition-colors hover:text-fg">
                      {c.label}
                    </Link>
                  ) : (
                    <span>{c.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-fg">{title}</h1>
            {description && (
              <p className="mt-1 max-w-2xl text-xs text-fg-muted">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

/** Contenedor del cuerpo de una página, con el ancho máximo del sistema. */
export function PageBody({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6">{children}</div>
  );
}
