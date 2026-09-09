"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Icon, Select, cn, controlClass } from "@/components/ui";
import { ACTIVACION_OPTIONS } from "@/lib/types";

/**
 * Barra de búsqueda y filtros del listado.
 *
 * El estado vive en la URL, no en el componente. Así una búsqueda se puede
 * compartir por enlace, sobrevive a recargar la página y funciona con el
 * botón de atrás — y el filtrado real ocurre en el servidor, sobre la base
 * de datos, no sobre un arreglo ya traído al navegador.
 */
export function CotizacionesFiltros({ total }: { total: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  const qUrl = searchParams.get("q") ?? "";
  const [q, setQ] = useState(qUrl);

  // Sincroniza el input cuando la URL cambia por fuera (botón atrás/adelante).
  // Es el patrón que documenta React para ajustar estado ante un valor
  // externo: comparar durante el render, no un useEffect con setState —
  // eso provoca un render extra y lo prohíbe la regla de lint.
  const [qPrevio, setQPrevio] = useState(qUrl);
  if (qUrl !== qPrevio) {
    setQPrevio(qUrl);
    setQ(qUrl);
  }

  function aplicar(cambios: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    startTransition(() => {
      router.replace(params.toString() ? `/cotizaciones?${params}` : "/cotizaciones");
    });
  }

  const activacion = searchParams.get("activacion") ?? "";
  const orden = searchParams.get("orden") ?? "recientes";
  const hayFiltros = Boolean(qUrl || activacion || orden !== "recientes");

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar({ q });
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
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => aplicar({ q })}
          placeholder="Buscar marca, contacto o evento…"
          aria-label="Buscar cotizaciones por marca, contacto o evento"
          className={cn(controlClass, "pl-8")}
        />
      </form>

      <div className="w-40">
        <Select
          aria-label="Filtrar por tipo de activación"
          options={ACTIVACION_OPTIONS}
          placeholder="Toda activación"
          value={activacion}
          onChange={(e) => aplicar({ activacion: e.target.value })}
        />
      </div>

      <div className="w-44">
        <Select
          aria-label="Ordenar"
          options={[
            { value: "recientes", label: "Más recientes" },
            { value: "antiguas", label: "Más antiguas" },
            { value: "mayor", label: "Mayor objetivo" },
            { value: "menor", label: "Menor objetivo" },
          ]}
          value={orden}
          onChange={(e) => aplicar({ orden: e.target.value })}
        />
      </div>

      {hayFiltros && (
        <Button
          variant="ghost"
          size="md"
          icon="close"
          onClick={() => {
            setQ("");
            startTransition(() => router.replace("/cotizaciones"));
          }}
        >
          Limpiar
        </Button>
      )}

      {/* aria-live: el conteo cambia sin recargar, hay que anunciarlo */}
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "ml-auto text-xs text-fg-subtle transition-opacity",
          pendiente && "opacity-50",
        )}
      >
        {total} {total === 1 ? "cotización" : "cotizaciones"}
      </p>
    </div>
  );
}
