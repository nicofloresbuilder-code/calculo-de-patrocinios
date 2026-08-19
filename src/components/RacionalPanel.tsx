"use client";

interface RacionalState {
  status: "idle" | "loading" | "error" | "done";
  narrativa?: string;
  comparablesIds?: string[];
  error?: string;
}

export function RacionalPanel({ state }: { state: RacionalState }) {
  if (state.status === "idle") {
    return (
      <p className="text-sm text-aforo-fg-muted">
        Narrativa generada por IA explicando el racional, más los comparables
        históricos más cercanos.
      </p>
    );
  }

  if (state.status === "loading") {
    return <p className="text-sm text-aforo-fg-muted">Generando racional…</p>;
  }

  if (state.status === "error") {
    return (
      <p className="text-sm text-red-400">
        {state.error ?? "No se pudo generar la narrativa."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-xs text-aforo-teal">
        <span className="h-1.5 w-1.5 rounded-full bg-aforo-teal" />
        Generado por IA · el precio no cambia
      </p>
      <p className="text-sm leading-relaxed text-aforo-fg">{state.narrativa}</p>
      {state.comparablesIds && state.comparablesIds.length > 0 && (
        <p className="text-xs text-aforo-fg-muted">
          Comparables más cercanos: {state.comparablesIds.length}
        </p>
      )}
    </div>
  );
}

export type { RacionalState };
