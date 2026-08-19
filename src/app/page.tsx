import { Header } from "@/components/Header";
import { Panel } from "@/components/Panel";

const CAMPOS_EVENTO = [
  "Nombre del evento",
  "Aforo (capacidad)",
  "Duración (días)",
  "Caliber del line-up",
  "Exclusividad de categoría",
  "Tipo de activación",
  "Ciudad / venue",
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 px-6 py-8 sm:px-10 lg:grid-cols-[340px_1fr]">
        {/* Columna izquierda: variables del evento (Commit 3 agrega el form real) */}
        <Panel title="Variables del evento" className="h-fit">
          <ul className="space-y-3">
            {CAMPOS_EVENTO.map((campo) => (
              <li
                key={campo}
                className="rounded-md border border-dashed border-aforo-panel-border bg-aforo-input px-3 py-2.5 text-sm text-aforo-fg-muted"
              >
                {campo}
              </li>
            ))}
          </ul>
          <button
            disabled
            className="mt-5 w-full cursor-not-allowed rounded-md bg-aforo-accent/40 px-4 py-2.5 text-sm font-semibold text-aforo-bg"
          >
            Calcular rango sugerido
          </button>
        </Panel>

        {/* Columna derecha: resultado */}
        <div className="flex flex-col gap-6">
          <Panel title="Rango sugerido">
            <p className="text-sm text-aforo-fg-muted">
              Llena las variables del evento para ver el rango de precio
              sugerido, el objetivo de cierre y el desglose por variable.
            </p>
          </Panel>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-[2fr_1fr]">
            <Panel title="Desglose por variable">
              <p className="text-sm text-aforo-fg-muted">
                Aquí aparecerán las barras de aforo, line-up, exclusividad,
                duración, activación y ciudad una vez calculado el rango.
              </p>
            </Panel>

            <Panel title="Por qué este rango">
              <p className="text-sm text-aforo-fg-muted">
                Narrativa generada por IA explicando el racional, más los
                comparables históricos más cercanos.
              </p>
            </Panel>
          </div>
        </div>
      </main>
    </div>
  );
}
