import { PageBody, PageHeader } from "@/components/shell";
import { Cotizador } from "@/components/Cotizador";

export const metadata = { title: "Cotizador" };

export default function Home() {
  return (
    <>
      <PageHeader
        title="Cotizador de patrocinios"
        description="Rango de precio defendible a partir de las variables del evento. El número sale de una fórmula calibrada con deals reales, no del modelo de lenguaje."
      />
      <PageBody>
        <Cotizador />
      </PageBody>
    </>
  );
}
