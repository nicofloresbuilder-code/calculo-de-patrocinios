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
import { ACTIVACION_OPTIONS } from "@/lib/types";
import { CotizacionesFiltros } from "@/components/CotizacionesFiltros";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/cookieOptions";
import { getAuthzContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/can";

export const metadata = { title: "Cotizaciones" };

interface CotizacionRow {
  id: string;
  marca: string | null;
  contacto: string | null;
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

/** Escapa los comodines de PostgREST para que la búsqueda sea literal. */
function patronBusqueda(termino: string): string {
  return `%${termino.replace(/[%_,()]/g, "")}%`;
}

const ORDENES = {
  recientes: { columna: "creado_en", asc: false },
  antiguas: { columna: "creado_en", asc: true },
  mayor: { columna: "precio_objetivo", asc: false },
  menor: { columna: "precio_objetivo", asc: true },
} as const;

type OrdenKey = keyof typeof ORDENES;

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const soloTexto = (v: string | string[] | undefined) =>
    typeof v === "string" ? v.trim() : "";

  const q = soloTexto(sp.q).slice(0, 120);
  // El filtro se valida contra el catálogo: un valor arbitrario en la URL no
  // debe llegar a la consulta.
  const activacionParam = soloTexto(sp.activacion);
  const activacion = ACTIVACION_OPTIONS.some((o) => o.value === activacionParam)
    ? activacionParam
    : "";
  const ordenParam = soloTexto(sp.orden);
  const orden: OrdenKey = (
    ordenParam in ORDENES ? ordenParam : "recientes"
  ) as OrdenKey;

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
  // El filtrado ocurre en la base, no sobre un arreglo ya traído: con
  // cientos de cotizaciones, filtrar en el cliente sería traerlas todas.
  let consulta = supabase
    .from("cotizaciones")
    .select(
      "id, marca, contacto, nombre_evento, activacion, aforo, precio_min, precio_objetivo, precio_max, creado_en",
    );

  if (q) {
    const patron = patronBusqueda(q);
    consulta = consulta.or(
      `marca.ilike.${patron},contacto.ilike.${patron},nombre_evento.ilike.${patron}`,
    );
  }
  if (activacion) consulta = consulta.eq("activacion", activacion);

  const { columna, asc } = ORDENES[orden];
  const { data: cotizaciones, error } = await consulta
    .order(columna, { ascending: asc, nullsFirst: false })
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

  const hayFiltros = Boolean(q || activacion);
  const filas = cotizaciones ?? [];

  if (filas.length === 0) {
    // Dos estados vacíos distintos: "no hay nada" pide crear la primera
    // cotización; "no hay resultados" pide cambiar la búsqueda. Ofrecer
    // "Ir al cotizador" a quien solo buscó mal sería inútil.
    return (
      <PageFrame count={0} mostrarFiltros={hayFiltros}>
        <Card>
          {hayFiltros ? (
            <EmptyState
              icon="search"
              title="Ninguna cotización coincide con la búsqueda"
              description="Prueba con otro término o quita los filtros."
              action={
                <LinkButton href="/cotizaciones" variant="secondary" size="sm">
                  Quitar filtros
                </LinkButton>
              }
            />
          ) : (
            <EmptyState
              title="Todavía no has guardado ninguna cotización"
              description="Calcula un rango en el cotizador y guárdalo para tenerlo aquí."
              action={
                <LinkButton href="/" variant="primary" size="sm">
                  Ir al cotizador
                </LinkButton>
              }
            />
          )}
        </Card>
      </PageFrame>
    );
  }

  return (
    <PageFrame count={filas.length} mostrarFiltros>
      <Card flush>
        <Table>
          <THead>
            <TR>
              <TH>Marca</TH>
              <TH>Contacto</TH>
              <TH>Evento</TH>
              <TH>Activación</TH>
              <TH numeric>Aforo</TH>
              <TH numeric>Objetivo</TH>
              <TH numeric>Rango</TH>
              <TH numeric>Creada</TH>
            </TR>
          </THead>
          <TBody>
            {filas.map((c) => (
              <TR key={c.id} interactive>
                <TD className="font-medium">
                  {c.marca ?? <span className="text-fg-subtle">—</span>}
                </TD>
                <TD className="text-fg-muted">
                  {c.contacto ?? <span className="text-fg-subtle">—</span>}
                </TD>
                <TD>{c.nombre_evento}</TD>
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
  mostrarFiltros = false,
  children,
}: {
  count?: number;
  mostrarFiltros?: boolean;
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
      <PageBody>
        {mostrarFiltros && <CotizacionesFiltros total={count ?? 0} />}
        {children}
      </PageBody>
    </>
  );
}
