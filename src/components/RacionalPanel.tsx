"use client";

import { Alert, Badge, SkeletonText } from "@/components/ui";

interface RacionalState {
  status: "idle" | "loading" | "error" | "done";
  narrativa?: string;
  comparablesIds?: string[];
  error?: string;
}

export function RacionalPanel({ state }: { state: RacionalState }) {
  if (state.status === "idle") {
    return (
      <p className="text-xs text-fg-subtle">
        Al calcular, aquí aparece la explicación del racional y los comparables
        históricos más cercanos.
      </p>
    );
  }

  if (state.status === "loading") {
    return (
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Generando el racional…</span>
        <SkeletonText lines={4} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <Alert tone="warning" title="Sin racional generado">
        {state.error ?? "No se pudo generar la narrativa."} El rango de precio no
        depende de esto y sigue siendo válido.
      </Alert>
    );
  }

  return (
    <div className="space-y-3" aria-live="polite">
      <Badge tone="info" dot>
        Generado por IA · el precio no cambia
      </Badge>
      <p className="text-sm leading-relaxed text-fg">{state.narrativa}</p>
      {state.comparablesIds && state.comparablesIds.length > 0 && (
        <p className="text-xs text-fg-subtle">
          Basado en {state.comparablesIds.length}{" "}
          {state.comparablesIds.length === 1 ? "comparable" : "comparables"} del
          histórico.
        </p>
      )}
    </div>
  );
}

export type { RacionalState };
