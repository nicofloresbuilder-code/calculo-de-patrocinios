"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { EventoInput } from "@/lib/types";
import type { ComputePriceResult } from "@/lib/pricing";

type Status = "checking" | "signed-out" | "idle" | "saving" | "saved" | "error";

export function GuardarCotizacion({
  evento,
  resultado,
  narrativa,
}: {
  evento: EventoInput;
  resultado: ComputePriceResult;
  narrativa: string | null;
}) {
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const [status, setStatus] = useState<Status>(
    supabaseConfigured ? "checking" : "signed-out",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setStatus(data.user ? "idle" : "signed-out");
    });
  }, [supabaseConfigured]);

  async function handleGuardar() {
    setStatus("saving");
    setError(null);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setStatus("signed-out");
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
      precio_min: resultado.min,
      precio_objetivo: resultado.objetivo,
      precio_max: resultado.max,
      desglose: resultado.desglose,
      racional: narrativa,
    });

    if (insertError) {
      setStatus("error");
      setError(insertError.message);
      return;
    }
    setStatus("saved");
  }

  if (status === "checking") return null;

  if (status === "signed-out") {
    return (
      <p className="text-xs text-aforo-fg-muted">
        Inicia sesión con Google (arriba a la derecha) para guardar esta
        cotización.
      </p>
    );
  }

  if (status === "saved") {
    return (
      <p className="text-xs text-aforo-teal">
        Cotización guardada. Ver en{" "}
        <Link href="/cotizaciones" className="underline">
          Mis cotizaciones
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleGuardar}
        disabled={status === "saving"}
        className="rounded-md border border-aforo-panel-border bg-aforo-input px-3 py-1.5 text-xs text-aforo-fg transition-colors hover:border-aforo-accent disabled:opacity-50"
      >
        {status === "saving" ? "Guardando…" : "Guardar cotización"}
      </button>
      {status === "error" && (
        <span className="text-xs text-red-400">{error}</span>
      )}
    </div>
  );
}
