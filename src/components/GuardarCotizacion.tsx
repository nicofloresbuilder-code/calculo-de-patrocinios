"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { EventoInput } from "@/lib/types";
import type { ComputePriceResult } from "@/lib/pricing";
import { Alert, Button } from "@/components/ui";
import { Can } from "@/components/auth/Can";
import { useAuthz } from "@/components/auth/AuthzProvider";

type Status = "idle" | "saving" | "saved" | "error";

export function GuardarCotizacion({
  evento,
  resultado,
  narrativa,
}: {
  evento: EventoInput;
  resultado: ComputePriceResult;
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

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setStatus("error");
      setError("Tu sesión expiró. Vuelve a iniciar sesión para guardar.");
      return;
    }

    // RLS exige auth.uid() = user_id — se manda explícito, no implícito.
    const { error: insertError } = await supabase.from("cotizaciones").insert({
      user_id: userData.user.id,
      nombre_evento: evento.nombre_evento,
      aforo: evento.aforo,
      dias: evento.dias,
      lineup: evento.lineup,
      exclusiva: evento.exclusiva,
      activacion: evento.activacion,
      ciudad_tier: evento.ciudad_tier,
      // Requieren la migración 0002_territorio_producto.sql.
      territorio_lado: evento.territorio_lado,
      paga_con_producto: evento.paga_con_producto,
      monto_producto: evento.paga_con_producto ? evento.monto_producto : null,
      precio_min: resultado.min,
      precio_objetivo: resultado.objetivo,
      precio_max: resultado.max,
      desglose: resultado.desglose,
      racional: narrativa,
    });

    if (insertError) {
      // El mensaje crudo de Supabase se registra para depurar, pero no se le
      // enseña al usuario: filtra detalle de la base de datos y no es
      // accionable para quien está cotizando.
      console.error("Error al guardar la cotización:", insertError);
      setStatus("error");
      setError("No se pudo guardar la cotización. Inténtalo de nuevo.");
      return;
    }
    setStatus("saved");
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
