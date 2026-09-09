import { PageBody, PageHeader } from "@/components/shell";
import { Alert, Card, EmptyState } from "@/components/ui";
import { EventosAdmin } from "@/components/eventos/EventosAdmin";
import { listarEventos } from "@/lib/eventos";

export const metadata = { title: "Eventos" };

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Administración" }, { label: "Eventos" }]}
        title="Catálogo de eventos"
        description="Los eventos se cargan una vez y se cotizan a varias marcas. Aquí viven aforo, duración, line-up y ciudad; la exclusividad, la activación y el territorio se negocian en cada cotización."
      />
      <PageBody>{children}</PageBody>
    </>
  );
}

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q.trim() : "").slice(0, 120);

  // La autorización la resuelve `listarEventos` del lado del servidor.
  // Esconder el módulo en la barra lateral no protege esta ruta: quien
  // escriba la URL a mano cae aquí igual, y aquí es donde se comprueba.
  const resultado = await listarEventos({ q });

  if (resultado.estado === "sin-configurar") {
    return (
      <Marco>
        <Alert tone="warning" title="Supabase no está conectado en este ambiente">
          El catálogo de eventos no se puede leer hasta que el proyecto de
          Supabase esté configurado.
        </Alert>
      </Marco>
    );
  }

  if (resultado.estado === "sin-permiso") {
    return (
      <Marco>
        <Card>
          <EmptyState
            icon="user"
            title="Sin acceso al catálogo de eventos"
            description="Inicia sesión con una cuenta que tenga permiso para ver eventos."
          />
        </Card>
      </Marco>
    );
  }

  if (resultado.estado === "error") {
    return (
      <Marco>
        <Alert tone="danger" title="No se pudo cargar el catálogo">
          Vuelve a intentarlo en unos momentos.
        </Alert>
      </Marco>
    );
  }

  return (
    <Marco>
      <EventosAdmin eventos={resultado.eventos} q={q} />
    </Marco>
  );
}
