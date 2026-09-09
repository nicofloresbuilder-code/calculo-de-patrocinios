"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, Icon } from "@/components/ui";
import { isActive, type NavSection } from "@/lib/navigation";

/**
 * Barra lateral de módulos. Recibe las secciones YA filtradas por permisos
 * desde el servidor — el cliente nunca decide qué módulos existen.
 */
export function Sidebar({
  sections,
  onNavigate,
}: {
  sections: readonly NavSection[];
  /** Se llama al navegar; en móvil sirve para cerrar el panel. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Módulos" className="flex flex-col gap-6 p-3">
      {sections.map((section, i) => (
        <div key={section.title ?? `s${i}`}>
          {section.title && (
            <p className="mb-1.5 px-2.5 text-2xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">
              {section.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(item, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 ease-out",
                      active
                        ? "bg-raised font-medium text-fg"
                        : "text-fg-muted hover:bg-raised/60 hover:text-fg",
                    )}
                  >
                    {/* Indicador de activo que no depende solo del color */}
                    <span
                      aria-hidden
                      className={cn(
                        "h-4 w-0.5 shrink-0 rounded-full",
                        active ? "bg-primary" : "bg-transparent",
                      )}
                    />
                    <Icon name={item.icon} size={16} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
