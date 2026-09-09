"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Icon, cn } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { useAuthz } from "@/components/auth/AuthzProvider";

/**
 * Menú de usuario del topbar. Es el lugar donde después cuelgan perfil,
 * preferencias y cambio de contraseña — hoy tiene sesión y cerrar sesión.
 */
export function UserMenu() {
  const ctx = useAuthz();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /**
   * Antes esto no miraba el resultado. Si Supabase devolvía un error —el
   * proveedor apagado, la URL de retorno fuera de la lista, las variables
   * de entorno sin configurar— el botón se quedaba girando y en pantalla
   * no pasaba absolutamente nada. Un fallo silencioso en el login es de lo
   * peor que puede hacer una aplicación: no hay forma de saber qué
   * arreglar.
   */
  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (err) {
        console.error("Error al iniciar sesión con Google:", err);
        setError(err.message);
        setBusy(false);
      }
      // Sin error el navegador se va a Google: no hay nada que apagar.
    } catch (e) {
      // createClient() revienta si faltan las variables públicas de
      // Supabase, y eso pasa antes de cualquier petición.
      console.error("No se pudo iniciar el flujo de sesión:", e);
      setError(
        "No se pudo contactar al servicio de autenticación. Revisa la configuración de Supabase.",
      );
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    // `refresh()` re-renderiza los Server Components con la sesión ya cerrada,
    // sin recargar la página entera (antes era window.location.reload()).
    router.refresh();
    setBusy(false);
  }

  if (!ctx.userId) {
    return (
      <div className="relative">
        <Button variant="primary" size="sm" onClick={signIn} loading={busy}>
          Iniciar sesión
        </Button>
        {error && (
          <Alert
            tone="danger"
            title="No se pudo iniciar sesión"
            className="absolute right-0 top-full z-50 mt-1.5 w-72 bg-raised shadow-lg"
          >
            {error}
          </Alert>
        )}
      </div>
    );
  }

  const initials = (ctx.displayName ?? ctx.email ?? "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex h-control items-center gap-2 rounded-md border border-line-subtle px-2 pr-2.5",
          "text-sm text-fg-muted transition-colors duration-150 ease-out",
          "hover:border-line hover:text-fg",
          open && "border-line bg-raised text-fg",
        )}
      >
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-2xs font-semibold text-primary"
        >
          {initials || "?"}
        </span>
        <span className="hidden max-w-[16ch] truncate sm:inline">
          {ctx.displayName ?? ctx.email}
        </span>
        <Icon name="chevronDown" size={14} className="shrink-0" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1.5 w-64 rounded-lg border border-line-subtle bg-raised p-1 shadow-lg"
        >
          <div className="border-b border-line-subtle px-3 py-2.5">
            <p className="truncate text-sm font-medium text-fg">
              {ctx.displayName ?? "Usuario"}
            </p>
            <p className="truncate text-xs text-fg-subtle">{ctx.email}</p>
            {ctx.role && (
              <p className="mt-1.5 text-2xs font-medium uppercase tracking-wide text-primary">
                {ROLE_LABELS[ctx.role]}
              </p>
            )}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            disabled={busy}
            className="mt-1 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface hover:text-fg disabled:opacity-50"
          >
            <Icon name="logout" size={16} />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
