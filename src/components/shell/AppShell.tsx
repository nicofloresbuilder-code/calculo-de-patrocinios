"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Button, Icon, cn } from "@/components/ui";
import type { NavSection } from "@/lib/navigation";
import { Sidebar } from "./Sidebar";
import { UserMenu } from "./UserMenu";

/**
 * ESTRUCTURA DE LA PLATAFORMA
 * ===========================
 *   ┌──────────┬──────────────────────────────────┐
 *   │ sidebar  │ topbar (contexto · usuario)      │
 *   │ módulos  ├──────────────────────────────────┤
 *   │          │ contenido (breadcrumb, título,   │
 *   │          │ acciones primarias, cuerpo)      │
 *   └──────────┴──────────────────────────────────┘
 *
 * En ≥1024px la barra lateral es fija. Por debajo se convierte en un panel
 * que se abre desde el topbar — el contenido nunca compite por el ancho en
 * pantallas chicas.
 *
 * Las `sections` llegan ya filtradas por permisos desde el layout de
 * servidor: este componente no decide accesos, solo los pinta.
 */
export function AppShell({
  sections,
  children,
}: {
  sections: readonly NavSection[];
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* WCAG 2.4.1 — saltar la navegación repetida */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-fg"
      >
        Saltar al contenido
      </a>

      <div className="flex flex-1">
        {/* Barra lateral fija (desktop) */}
        <aside className="hidden w-60 shrink-0 border-r border-line-subtle bg-surface lg:flex lg:flex-col">
          <Wordmark className="h-14 border-b border-line-subtle px-4" />
          <div className="flex-1 overflow-y-auto">
            <Sidebar sections={sections} />
          </div>
        </aside>

        {/* Panel deslizante (móvil / tablet) */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Cerrar navegación"
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-canvas/80"
            />
            <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-line-subtle bg-surface shadow-lg">
              <div className="flex h-14 items-center justify-between border-b border-line-subtle pl-4 pr-2">
                <Wordmark />
                <Button
                  variant="ghost"
                  size="sm"
                  icon="close"
                  aria-label="Cerrar navegación"
                  onClick={() => setMobileOpen(false)}
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                <Sidebar sections={sections} onNavigate={() => setMobileOpen(false)} />
              </div>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line-subtle bg-canvas/95 px-4 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon="menu"
                aria-label="Abrir navegación"
                className="lg:hidden"
                onClick={() => setMobileOpen(true)}
              />
              <Wordmark className="lg:hidden" />
            </div>
            <div className="flex items-center gap-2">
              <UserMenu />
            </div>
          </header>

          <main id="contenido" className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2 text-fg", className)}
      aria-label="Aforo — inicio"
    >
      <span
        aria-hidden
        className="flex size-6 items-center justify-center rounded bg-primary text-primary-fg"
      >
        <Icon name="calculator" size={14} />
      </span>
      <span className="font-display text-lg font-bold tracking-tight">AFORO</span>
    </Link>
  );
}
