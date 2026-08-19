"use client";

import { useState } from "react";
import { Panel } from "./Panel";
import { EventoForm } from "./EventoForm";
import { RangoBar } from "./RangoBar";
import { DesglosePanel } from "./DesglosePanel";
import { computePrice, type ComputePriceResult } from "@/lib/pricing";
import type { EventoInput } from "@/lib/types";

export function Cotizador() {
  const [resultado, setResultado] = useState<ComputePriceResult | null>(null);

  function handleSubmit(evento: EventoInput) {
    setResultado(computePrice(evento));
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
            <p className="text-sm text-aforo-fg-muted">
              Narrativa generada por IA explicando el racional, más los
              comparables históricos más cercanos.{" "}
              <span className="text-aforo-fg-muted/70">(Commit 5)</span>
            </p>
          </Panel>
        </div>
      </div>
    </main>
  );
}
