"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { EventoInput } from "@/lib/types";
import { Alert, Button } from "@/components/ui";
import { Can } from "@/components/auth/Can";
import { useAuthz } from "@/components/auth/AuthzProvider";

type Status = "idle" | "saving" | "saved" | "error";

export function GuardarCotizacion({
  evento,
  narrativa,
}: {
  evento: EventoInput;
  /** Racional generado por la IA. Opcional: la cotización se guarda sin él. */
  narrativa: string | null;
}) {
  // La sesión ya la resolvió el servidor y bajó por contexto. Antes este
  // componente volvía a preguntarle a Supabase desde el cliente, lo que
  // costaba un round-trip y hacía parpadear el botón.
  const ctx = useAuthz();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleGuardar() {
    setStatus("saving");
    setError(null);

    // El guardado pasa por el servidor, no por el cliente de Supabase.
    // Motivo: antes el navegador escribía `precio_min/objetivo/max` y
    // `desglose` directamente en la tabla. RLS impedía escribir en el
    // renglón de otro usuario, pero no impedía guardar CUALQUIER precio —
    // y todo el valor del producto depende de que la cifra guardada sea la
    // que produjo la fórmula. Ahora el servidor la recalcula.
    //
    // Solo se mandan las variables del evento. El precio ni siquiera se
    // envía: el servidor lo ignoraría.
    try {
      const res = await fetch("/api/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evento, racional: narrativa }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatus("error");
        setError(
          res.status === 429
            ? "Demasiadas cotizaciones seguidas. Espera un momento."
            : (body?.error ?? "No se pudo guardar la cotización."),
        );
        return;
      }
      setStatus("saved");
    } catch {
      setStatus("error");
      setError("No se pudo guardar la cotización. Revisa tu conexión.");
    }
  }

  if (!ctx.userId) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-fg-subtle">
          Inicia sesión para guardar esta cotización y consultarla después.
        </p>
        <Button size="sm" onClick={signIn}>
          Iniciar sesión
        </Button>
      </div>
    );
  }

  if (status === "saved") {
    return (
      <Alert
        tone="success"
        title="Cotización guardada"
        action={
          <Link
            href="/cotizaciones"
            className="text-xs font-medium text-success underline underline-offset-2"
          >
            Ver todas
          </Link>
        }
      />
    );
  }

  return (
    <Can
      permission="quotes.create"
      fallback={
        <p className="text-xs text-fg-subtle">
          Tu rol no permite guardar cotizaciones.
        </p>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          icon="check"
          onClick={handleGuardar}
          loading={status === "saving"}
        >
          {status === "saving" ? "Guardando…" : "Guardar cotización"}
        </Button>
        {status === "error" && error && (
          <span role="alert" className="text-xs text-danger">
            {error}
          </span>
        )}
      </div>
    </Can>
  );
}
