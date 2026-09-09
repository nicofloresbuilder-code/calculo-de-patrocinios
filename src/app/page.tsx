import { PageBody, PageHeader } from "@/components/shell";
import { Cotizador } from "@/components/Cotizador";
import { listarEventos } from "@/lib/eventos";

export const metadata = { title: "Cotizador" };

export default async function Home() {
  // El catálogo se resuelve en el servidor, con su comprobación de permiso.
  // Sin sesión o sin `events.view` simplemente no hay selector: el
  // formulario sigue funcionando a mano, como antes.
  const catalogo = await listarEventos({ soloActivos: true });
  const eventos = catalogo.estado === "ok" ? catalogo.eventos : [];

  return (
    <>
      <PageHeader
        title="Cotizador de patrocinios"
        description="Rango de precio defendible a partir de las variables del evento. El número sale de una fórmula calibrada con deals reales, no del modelo de lenguaje."
      />
      <PageBody>
        <Cotizador eventos={eventos} />
      </PageBody>
    </>
  );
}
