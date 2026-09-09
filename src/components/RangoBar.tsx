import { formatMXN } from "@/lib/format";
import { Metric } from "@/components/ui";

/**
 * Escala de negociación.
 *
 * Nota de la auditoría: la versión anterior dibujaba un punto cuya posición
 * pretendía ser informativa y no lo era — con `min = objetivo × 0.75` y
 * `max = objetivo × 1.3`, el objetivo cae SIEMPRE en el 45.45% del rango,
 * para cualquier evento. Se mantiene la escala (comunica dónde está el
 * objetivo respecto al piso y al techo) pero ahora cada extremo lleva su
 * cifra y su desviación, que sí es la información que se usa en la llamada
 * con la marca.
 */
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
  const deltaMin = Math.round((min / objetivo - 1) * 100);
  const deltaMax = Math.round((max / objetivo - 1) * 100);

  return (
    <div>
      {/* aria-live: el resultado del cálculo se anuncia, antes era silencioso */}
      <div role="status" aria-live="polite">
        <Metric
          label="Objetivo de cierre"
          value={formatMXN(objetivo)}
          size="lg"
          tone="primary"
          detail={
            <>
              MXN · rango de negociación{" "}
              <span className="text-fg">
                {formatMXN(min)} – {formatMXN(max)}
              </span>
            </>
          }
        />
      </div>

      <div className="mt-6">
        <div className="relative h-1.5 rounded-full bg-line-subtle">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-info"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-canvas bg-primary"
            style={{ left: `${Math.min(Math.max(pct, 0), 100)}%` }}
          />
        </div>

        <div className="mt-2.5 flex items-start justify-between gap-2 text-xs">
          <span className="text-left">
            <span className="block text-fg-muted">{formatMXN(min)}</span>
            <span className="block text-2xs text-fg-subtle">piso · {deltaMin}%</span>
          </span>
          <span className="text-right">
            <span className="block text-fg-muted">{formatMXN(max)}</span>
            <span className="block text-2xs text-fg-subtle">techo · +{deltaMax}%</span>
          </span>
        </div>
      </div>
    </div>
  );
}
