import { Header } from "@/components/Header";
import { Panel } from "@/components/Panel";
import { EventoForm } from "@/components/EventoForm";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 px-6 py-8 sm:px-10 lg:grid-cols-[340px_1fr]">
        {/* Columna izquierda: variables del evento */}
        <Panel title="Variables del evento" className="h-fit">
          <EventoForm />
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
