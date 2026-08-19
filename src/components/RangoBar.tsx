import { formatMXN } from "@/lib/format";

export function RangoBar({
  min,
  objetivo,
  max,
}: {
  min: number;
  objetivo: number;
  max: number;
}) {
  const pct = ((objetivo - min) / (max - min)) * 100;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-aforo-fg-muted">
        Rango sugerido
      </p>
      <p className="mt-2 font-serif text-3xl font-bold sm:text-4xl">
        {formatMXN(min)} – {formatMXN(max)}
      </p>
      <p className="mt-1 text-sm text-aforo-accent">
        MXN · objetivo de cierre: {formatMXN(objetivo)}
      </p>

      <div className="relative mt-6 h-2 rounded-full bg-aforo-teal/40">
        <div className="absolute inset-y-0 left-0 w-full rounded-full bg-aforo-teal" />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-aforo-bg bg-aforo-accent"
          style={{ left: `${Math.min(Math.max(pct, 0), 100)}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-aforo-fg-muted">
        <span>mín</span>
        <span className="text-aforo-accent">objetivo</span>
        <span>máx</span>
      </div>
    </div>
  );
}
