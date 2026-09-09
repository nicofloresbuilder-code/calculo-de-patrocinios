import type { PriceFactors } from "@/lib/pricing";

const LABELS: Record<keyof PriceFactors, string> = {
  aforo: "Aforo",
  territorio: "Territorio",
  lineup: "Line-up",
  exclusividad: "Exclusividad",
  duracion: "Duración",
  ciudad: "Ciudad/venue",
};

// Orden fijo (no el de Object.entries) para que las barras salgan siempre
// en el mismo orden visual sin importar cómo se insertó cada llave.
const ORDER: (keyof PriceFactors)[] = [
  "aforo",
  "territorio",
  "lineup",
  "exclusividad",
  "duracion",
  "ciudad",
];

export function DesglosePanel({
  desglose,
}: {
  desglose: Record<keyof PriceFactors, number>;
}) {
  // Un factor en 1.0 aporta 0% — es correcto, pero leído como "0%" parece un
  // error de cálculo. Se etiqueta como neutro para que se entienda que la
  // variable está en su valor de referencia, no que no importe.
  return (
    <ul className="space-y-3">
      {ORDER.map((key) => {
        const valor = desglose[key];
        return (
          <li key={key} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs text-fg-muted">
              {LABELS[key]}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-subtle">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(valor, 100)}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs text-fg">
              {valor === 0 ? (
                <span className="text-fg-subtle">neutro</span>
              ) : (
                `${valor}%`
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
