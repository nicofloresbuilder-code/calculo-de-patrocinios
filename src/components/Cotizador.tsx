"use client";

import { useRef, useState } from "react";
import { Card, EmptyState } from "@/components/ui";
import { EventoForm } from "./EventoForm";
import { RangoBar } from "./RangoBar";
import { DesglosePanel } from "./DesglosePanel";
import { RacionalPanel, type RacionalState } from "./RacionalPanel";
import { GuardarCotizacion } from "./GuardarCotizacion";
import { ProductoPanel } from "./ProductoPanel";
import { computePrice, type ComputePriceResult } from "@/lib/pricing";
import type { EventoInput } from "@/lib/types";

export function Cotizador() {
  const [evento, setEvento] = useState<EventoInput | null>(null);
  const [resultado, setResultado] = useState<ComputePriceResult | null>(null);
  const [racional, setRacional] = useState<RacionalState>({ status: "idle" });
  const resultadosRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(nuevoEvento: EventoInput) {
    setEvento(nuevoEvento);
    const precio = computePrice(nuevoEvento);
    setResultado(precio);
    setRacional({ status: "loading" });

    // En una columna (móvil/tablet) el resultado queda debajo de todo el
    // formulario: sin esto, el usuario calcula y en pantalla no pasa nada.
    // En escritorio el resultado ya está a la vista y no se hace nada.
    if (window.matchMedia("(max-width: 767px)").matches) {
      requestAnimationFrame(() => {
        resultadosRef.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        });
      });
    }

    try {
      const res = await fetch("/api/narrativa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento: nuevoEvento,
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

  const calculado = resultado !== null && evento !== null;

  return (
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* Entradas — se quedan a la vista mientras se leen los resultados */}
      <Card title="Variables del evento" className="md:sticky md:top-[4.5rem]">
        <EventoForm onSubmit={handleSubmit} />
      </Card>

      {/* Resultados. `scroll-mt` deja aire para la barra superior fija. */}
      <div ref={resultadosRef} className="flex scroll-mt-20 flex-col gap-4">
        {!calculado ? (
          // Antes esta columna eran tres cajas con texto explicativo que
          // ocupaban dos tercios de la pantalla sin decir nada accionable.
          <Card>
            <EmptyState
              icon="calculator"
              title="Sin cotización todavía"
              description="Llena las variables del evento y calcula el rango. Vas a ver el precio mínimo, el objetivo de cierre y cuánto pesa cada variable en ese número."
            />
          </Card>
        ) : (
          <>
            <Card raised>
              <RangoBar
                min={resultado.min}
                objetivo={resultado.objetivo}
                max={resultado.max}
              />
              <div className="mt-5 border-t border-line-subtle pt-4">
                <GuardarCotizacion
                  evento={evento}
                  narrativa={
                    racional.status === "done" ? (racional.narrativa ?? null) : null
                  }
                />
              </div>
            </Card>

            {evento.paga_con_producto && evento.monto_producto > 0 && (
              <Card title="Pago en especie · ¿se puede hacer líquido?">
                <ProductoPanel
                  montoEnProducto={evento.monto_producto}
                  montoEfectivo={Math.max(0, resultado.objetivo - evento.monto_producto)}
                  aforo={evento.aforo}
                  dias={evento.dias}
                />
              </Card>
            )}

            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Card title="Desglose por variable">
                <DesglosePanel desglose={resultado.desglose} />
              </Card>
              <Card title="Por qué este rango">
                <RacionalPanel state={racional} />
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
