"use client";

import { useState } from "react";
import { Panel } from "./Panel";
import { EventoForm } from "./EventoForm";
import { RangoBar } from "./RangoBar";
import { DesglosePanel } from "./DesglosePanel";
import { RacionalPanel, type RacionalState } from "./RacionalPanel";
import { computePrice, type ComputePriceResult } from "@/lib/pricing";
import type { EventoInput } from "@/lib/types";

export function Cotizador() {
  const [resultado, setResultado] = useState<ComputePriceResult | null>(null);
  const [racional, setRacional] = useState<RacionalState>({ status: "idle" });

  async function handleSubmit(evento: EventoInput) {
    const precio = computePrice(evento);
    setResultado(precio);
    setRacional({ status: "loading" });

    try {
      const res = await fetch("/api/narrativa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento,
          precio: { min: precio.min, objetivo: precio.objetivo, max: precio.max },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setRacional({
          status: "error",
          error: body?.error ?? "No se pudo generar la narrativa.",
        });
        return;
      }

      const data = (await res.json()) as {
        narrativa: string;
        comparables_relevantes_ids: string[];
      };
      setRacional({
        status: "done",
        narrativa: data.narrativa,
        comparablesIds: data.comparables_relevantes_ids,
      });
    } catch {
      setRacional({ status: "error", error: "No se pudo generar la narrativa." });
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 px-6 py-8 sm:px-10 lg:grid-cols-[340px_1fr]">
      {/* Columna izquierda: variables del evento */}
      <Panel title="Variables del evento" className="h-fit">
        <EventoForm onSubmit={handleSubmit} />
      </Panel>

      {/* Columna derecha: resultado */}
      <div className="flex flex-col gap-6">
        <Panel>
          {resultado ? (
            <RangoBar min={resultado.min} objetivo={resultado.objetivo} max={resultado.max} />
          ) : (
            <>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-aforo-fg-muted">
                Rango sugerido
              </p>
              <p className="text-sm text-aforo-fg-muted">
                Llena las variables del evento y presiona &ldquo;Calcular rango
                sugerido&rdquo; para ver el rango de precio, el objetivo de cierre
                y el desglose por variable.
              </p>
            </>
          )}
        </Panel>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[2fr_1fr]">
          <Panel title="Desglose por variable">
            {resultado ? (
              <DesglosePanel desglose={resultado.desglose} />
            ) : (
              <p className="text-sm text-aforo-fg-muted">
                Aquí aparecerán las barras de aforo, line-up, exclusividad,
                duración y ciudad una vez calculado el rango.
              </p>
            )}
          </Panel>

          <Panel title="Por qué este rango">
            <RacionalPanel state={racional} />
          </Panel>
        </div>
      </div>
    </main>
  );
}
