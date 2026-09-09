"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  cn,
  controlClass,
} from "@/components/ui";
import { Can } from "@/components/auth/Can";
import { usePermissions } from "@/components/auth/AuthzProvider";
import {
  CIUDAD_TIER_OPTIONS,
  LINEUP_OPTIONS,
  type EventoCatalogo,
  type EventoCatalogoInput,
} from "@/lib/types";
import type { EventoCatalogoErrors } from "@/lib/validateEventoCatalogo";
import {
  EVENTO_VACIO,
  EventoCatalogoForm,
  eventoAFormulario,
} from "./EventoCatalogoForm";

const numberFmt = new Intl.NumberFormat("es-MX");
const dateFmt = new Intl.DateTimeFormat("es-MX", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const LINEUP_CORTO: Record<string, string> = Object.fromEntries(
  LINEUP_OPTIONS.map((o) => [o.value, o.label.split("·")[1]?.trim() ?? o.value]),
);
const TIER_CORTO: Record<string, string> = Object.fromEntries(
  CIUDAD_TIER_OPTIONS.map((o) => [o.value, o.label.split("·")[0].trim()]),
);

type Modo =
  | { tipo: "lista" }
  | { tipo: "nuevo" }
  | { tipo: "editar"; evento: EventoCatalogo };

interface ErrorEnvio {
  mensaje: string;
  campos?: EventoCatalogoErrors;
}

/**
 * Administración del catálogo de eventos.
 *
 * RECORDATORIO: `<Can>` esconde controles, no protege nada. Cada llamada de
 * abajo pega contra /api/eventos, que vuelve a comprobar el permiso del
 * lado del servidor — quien llame la URL directo se topa con un 403 igual.
 */
export function EventosAdmin({
  eventos,
  q,
}: {
  eventos: EventoCatalogo[];
  q: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [buscando, startTransition] = useTransition();
  const { can } = usePermissions();

  const [modo, setModo] = useState<Modo>({ tipo: "lista" });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<ErrorEnvio | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const qUrl = searchParams.get("q") ?? "";
  const [texto, setTexto] = useState(qUrl);
  // Sincroniza el input cuando la URL cambia por fuera (botón atrás).
  const [qPrevio, setQPrevio] = useState(qUrl);
  if (qUrl !== qPrevio) {
    setQPrevio(qUrl);
    setTexto(qUrl);
  }

  function buscar(valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set("q", valor);
    else params.delete("q");
    startTransition(() => {
      router.replace(params.toString() ? `/admin/eventos?${params}` : "/admin/eventos");
    });
  }

  async function enviar(
    url: string,
    metodo: "POST" | "PATCH" | "DELETE",
    cuerpo?: unknown,
  ): Promise<boolean> {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: metodo,
        headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          detalles?: EventoCatalogoErrors;
        } | null;
        setError({
          mensaje: body?.error ?? "No se pudo completar la operación.",
          campos: body?.detalles,
        });
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError({ mensaje: "No se pudo conectar con el servidor." });
      return false;
    } finally {
      setEnviando(false);
    }
  }

  async function crear(evento: EventoCatalogoInput) {
    if (await enviar("/api/eventos", "POST", { evento })) setModo({ tipo: "lista" });
  }

  async function editar(id: string, evento: EventoCatalogoInput) {
    if (await enviar(`/api/eventos/${id}`, "PATCH", { evento }))
      setModo({ tipo: "lista" });
  }

  async function desactivar(id: string) {
    if (await enviar(`/api/eventos/${id}`, "DELETE")) setConfirmando(null);
  }

  async function reactivar(evento: EventoCatalogo) {
    await enviar(`/api/eventos/${evento.id}`, "PATCH", {
      evento: eventoAFormulario(evento),
      activo: true,
    });
  }

  if (modo.tipo === "nuevo") {
    return (
      <Card title="Nuevo evento">
        <EventoCatalogoForm
          inicial={EVENTO_VACIO}
          enviando={enviando}
          errorServidor={error?.mensaje}
          erroresServidor={error?.campos}
          textoAccion="Guardar evento"
          onSubmit={crear}
          onCancel={() => {
            setError(null);
            setModo({ tipo: "lista" });
          }}
        />
      </Card>
    );
  }

  if (modo.tipo === "editar") {
    const evento = modo.evento;
    return (
      <Card title={`Editar · ${evento.nombre}`}>
        <Alert tone="info" title="Las cotizaciones ya hechas no cambian">
          Cada cotización guarda su propia copia de estos datos. Editar el
          evento afecta a las cotizaciones nuevas, no a las que ya enviaste.
        </Alert>
        <div className="mt-4">
          <EventoCatalogoForm
            inicial={eventoAFormulario(evento)}
            enviando={enviando}
            errorServidor={error?.mensaje}
            erroresServidor={error?.campos}
            textoAccion="Guardar cambios"
            onSubmit={(datos) => editar(evento.id, datos)}
            onCancel={() => {
              setError(null);
              setModo({ tipo: "lista" });
            }}
          />
        </div>
      </Card>
    );
  }

  const puedeAdministrar = can("events.edit") || can("events.delete");

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            buscar(texto);
          }}
          className="relative min-w-0 flex-1 sm:max-w-xs"
        >
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={() => buscar(texto)}
            placeholder="Buscar evento…"
            aria-label="Buscar eventos por nombre"
            className={cn(controlClass, "pl-8")}
          />
        </form>

        <Can permission="events.create">
          <Button
            variant="primary"
            icon="plus"
            onClick={() => {
              setError(null);
              setModo({ tipo: "nuevo" });
            }}
          >
            Nuevo evento
          </Button>
        </Can>

        <p
          role="status"
          aria-live="polite"
          className={cn(
            "ml-auto text-xs text-fg-subtle transition-opacity",
            buscando && "opacity-50",
          )}
        >
          {eventos.length} {eventos.length === 1 ? "evento" : "eventos"}
        </p>
      </div>

      {error && (
        <Alert tone="danger" title="No se pudo completar la operación" className="mb-4">
          {error.mensaje}
        </Alert>
      )}

      <Card>
        {eventos.length === 0 ? (
          q ? (
            <EmptyState
              icon="search"
              title="Ningún evento coincide con la búsqueda"
              description="Prueba con otro nombre."
              action={
                <Button variant="secondary" size="sm" onClick={() => buscar("")}>
                  Quitar la búsqueda
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="calendar"
              title="El catálogo está vacío"
              description="Carga un evento con su aforo, duración, line-up y ciudad. Después se cotiza eligiéndolo, sin recapturar nada."
              action={
                <Can permission="events.create">
                  <Button
                    variant="primary"
                    icon="plus"
                    onClick={() => setModo({ tipo: "nuevo" })}
                  >
                    Nuevo evento
                  </Button>
                </Can>
              }
            />
          )
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Evento</TH>
                <TH numeric>Aforo</TH>
                <TH numeric>Días</TH>
                <TH>Line-up</TH>
                <TH>Ciudad</TH>
                <TH>Fecha</TH>
                <TH>Estado</TH>
                {/* Encabezado visible en vez de `sr-only`: dentro del
                    contenedor con scroll, un elemento absoluto se escapa del
                    recorte y hace que la PÁGINA entera pueda desplazarse en
                    horizontal. */}
                {puedeAdministrar && <TH className="text-right">Acciones</TH>}
              </TR>
            </THead>
            <TBody>
              {eventos.map((evento) => (
                <TR key={evento.id} interactive>
                  <TD>
                    <span className="font-medium">{evento.nombre}</span>
                    {evento.notas && (
                      <span className="mt-0.5 block max-w-xs truncate text-xs text-fg-subtle">
                        {evento.notas}
                      </span>
                    )}
                  </TD>
                  <TD numeric>{numberFmt.format(evento.aforo)}</TD>
                  <TD numeric>{evento.dias}</TD>
                  <TD>{LINEUP_CORTO[evento.lineup] ?? evento.lineup}</TD>
                  <TD>
                    {evento.ciudad || TIER_CORTO[evento.ciudad_tier] || "—"}
                    <span className="mt-0.5 block text-xs text-fg-subtle">
                      {TIER_CORTO[evento.ciudad_tier]}
                    </span>
                  </TD>
                  <TD>
                    {evento.fecha_inicio
                      ? dateFmt.format(new Date(`${evento.fecha_inicio}T00:00:00Z`))
                      : "—"}
                  </TD>
                  <TD>
                    {evento.activo ? (
                      <Badge tone="success" dot>
                        Activo
                      </Badge>
                    ) : (
                      <Badge tone="neutral" dot>
                        Inactivo
                      </Badge>
                    )}
                  </TD>
                  {puedeAdministrar && (
                    <TD className="text-right">
                      {confirmando === evento.id ? (
                        // Confirmación en la propia fila: una acción
                        // destructiva nunca se ejecuta al primer clic.
                        <span className="inline-flex items-center gap-2">
                          <span className="text-xs text-fg-muted">¿Dar de baja?</span>
                          <Button
                            variant="danger"
                            size="sm"
                            loading={enviando}
                            onClick={() => desactivar(evento.id)}
                          >
                            Sí, dar de baja
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmando(null)}
                          >
                            No
                          </Button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Can permission="events.edit">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setError(null);
                                setModo({ tipo: "editar", evento });
                              }}
                            >
                              Editar
                            </Button>
                          </Can>
                          {evento.activo ? (
                            <Can permission="events.delete">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmando(evento.id)}
                              >
                                Dar de baja
                              </Button>
                            </Can>
                          ) : (
                            <Can permission="events.edit">
                              <Button
                                variant="ghost"
                                size="sm"
                                loading={enviando}
                                onClick={() => reactivar(evento)}
                              >
                                Reactivar
                              </Button>
                            </Can>
                          )}
                        </span>
                      )}
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
