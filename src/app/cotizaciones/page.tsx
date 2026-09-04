import { PageBody, PageHeader } from "@/components/shell";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  LinkButton,
} from "@/components/ui";
import { formatMXN } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/cookieOptions";
import { getAuthzContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/can";

export const metadata = { title: "Cotizaciones" };

interface CotizacionRow {
  id: string;
  nombre_evento: string;
  activacion: string | null;
  aforo: number | null;
  precio_min: number | null;
  precio_objetivo: number | null;
  precio_max: number | null;
  creado_en: string;
}

const ACTIVACION_LABEL: Record<string, string> = {
  naming: "Naming",
  oficial: "Oficial",
  proveedor: "Proveedor",
  media: "Media",
};

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  year: "numeric",
  month: "short",
  day: "numeric",
});
const numberFmt = new Intl.NumberFormat("es-MX");

export default async function CotizacionesPage() {
  // Autorización del lado del servidor. Que la barra lateral esconda este
  // módulo no basta: la ruta se comprueba aquí, donde el usuario no puede
  // saltarse el chequeo escribiendo la URL.
  const ctx = await getAuthzContext();

  if (!supabaseConfigurado()) {
    return (
      <PageFrame>
        <Alert tone="warning" title="Supabase no está conectado en este ambiente">
          Las cotizaciones guardadas no se pueden leer hasta que el proyecto de
          Supabase esté configurado.
        </Alert>
      </PageFrame>
    );
  }

  if (!ctx.userId) {
    return (
      <PageFrame>
        <Card>
          <EmptyState
            icon="user"
            title="Inicia sesión para ver tus cotizaciones"
            description="Las cotizaciones guardadas son privadas de cada usuario."
          />
        </Card>
      </PageFrame>
    );
  }

  if (!can(ctx, "quotes.view")) {
    return (
      <PageFrame>
        <Alert tone="danger" title="Sin acceso">
          Tu rol no incluye el permiso para ver cotizaciones.
        </Alert>
      </PageFrame>
    );
  }

  const supabase = await createClient();
  // RLS ("usuario ve solo sus cotizaciones") ya filtra por auth.uid() = user_id.
  const { data: cotizaciones, error } = await supabase
    .from("cotizaciones")
    .select(
      "id, nombre_evento, activacion, aforo, precio_min, precio_objetivo, precio_max, creado_en",
    )
    .order("creado_en", { ascending: false })
    .returns<CotizacionRow[]>();

  if (error) {
    console.error("Error al leer cotizaciones:", error);
    return (
      <PageFrame>
        <Alert tone="danger" title="No se pudieron cargar las cotizaciones">
          Vuelve a intentarlo en unos momentos.
        </Alert>
      </PageFrame>
    );
  }

  if (!cotizaciones || cotizaciones.length === 0) {
    return (
      <PageFrame>
        <Card>
          <EmptyState
            title="Todavía no has guardado ninguna cotización"
            description="Calcula un rango en el cotizador y guárdalo para tenerlo aquí."
            action={
              <LinkButton href="/" variant="primary" size="sm">
                Ir al cotizador
              </LinkButton>
            }
          />
        </Card>
      </PageFrame>
    );
  }

  return (
    <PageFrame count={cotizaciones.length}>
      <Card flush>
        <Table>
          <THead>
            <TR>
              <TH>Evento</TH>
              <TH>Activación</TH>
              <TH numeric>Aforo</TH>
              <TH numeric>Objetivo</TH>
              <TH numeric>Rango</TH>
              <TH numeric>Creada</TH>
            </TR>
          </THead>
          <TBody>
            {cotizaciones.map((c) => (
              <TR key={c.id} interactive>
                <TD className="font-medium">{c.nombre_evento}</TD>
                <TD>
                  {c.activacion ? (
                    <Badge tone="neutral">
                      {ACTIVACION_LABEL[c.activacion] ?? c.activacion}
                    </Badge>
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )}
                </TD>
                <TD numeric className="text-fg-muted">
                  {c.aforo != null ? numberFmt.format(c.aforo) : "—"}
                </TD>
                <TD numeric className="font-semibold text-primary">
                  {c.precio_objetivo != null ? formatMXN(c.precio_objetivo) : "—"}
                </TD>
                <TD numeric className="text-xs text-fg-muted">
                  {c.precio_min != null && c.precio_max != null
                    ? `${formatMXN(c.precio_min)} – ${formatMXN(c.precio_max)}`
                    : "—"}
                </TD>
                <TD numeric className="text-xs text-fg-subtle">
                  {dateFmt.format(new Date(c.creado_en))}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </PageFrame>
  );
}

function PageFrame({
  count,
  children,
}: {
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Aforo", href: "/" }, { label: "Cotizaciones" }]}
        title="Cotizaciones"
        description={
          count !== undefined
            ? `${count} ${count === 1 ? "cotización guardada" : "cotizaciones guardadas"}.`
            : "Las cotizaciones que has guardado, de la más reciente a la más antigua."
        }
        actions={
          <LinkButton href="/" variant="primary" size="sm" icon="plus">
            Nueva cotización
          </LinkButton>
        }
      />
      <PageBody>{children}</PageBody>
    </>
  );
}
