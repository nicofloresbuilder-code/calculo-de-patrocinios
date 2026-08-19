import type { PriceFactors } from "@/lib/pricing";

const LABELS: Record<keyof PriceFactors, string> = {
  aforo: "Aforo",
  lineup: "Line-up",
  exclusividad: "Exclusividad",
  duracion: "Duración",
  ciudad: "Ciudad/venue",
};

// Orden fijo (no el de Object.entries) para que las barras salgan siempre
// en el mismo orden visual sin importar cómo se insertó cada llave.
const ORDER: (keyof PriceFactors)[] = [
  "aforo",
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
  return (
    <div className="space-y-4">
      {ORDER.map((key, i) => (
        <div key={key} className="flex items-center gap-4">
          <span className="w-28 shrink-0 text-sm text-aforo-fg">{LABELS[key]}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-aforo-input">
            <div
              className={`h-full rounded-full ${i % 2 === 0 ? "bg-aforo-accent" : "bg-aforo-teal"}`}
              style={{ width: `${Math.min(desglose[key], 100)}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-sm text-aforo-fg-muted">
            {desglose[key]}%
          </span>
        </div>
      ))}
    </div>
  );
}
