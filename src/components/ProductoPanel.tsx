"use client";

import { useState } from "react";
import {
  analizarProducto,
  valorRealDelDeal,
  SUPUESTOS_DEFAULT,
} from "@/lib/producto";
import { formatMXN } from "@/lib/format";
import { Alert, Field, Input, Metric } from "@/components/ui";

const nf = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });

/**
 * Análisis del pago en especie. La pregunta que contesta no es "cuánto
 * vendemos" sino si ese producto se puede hacer líquido — y cuánto es
 * demasiado producto para este aforo.
 *
 * Los tres supuestos son editables a propósito y están marcados como
 * supuestos: son un punto de partida inventado, no datos históricos.
 */
export function ProductoPanel({
  montoEnProducto,
  montoEfectivo,
  aforo,
  dias,
}: {
  montoEnProducto: number;
  montoEfectivo: number;
  aforo: number;
  dias: number;
}) {
  const [precioUnitarioMarca, setPrecioMarca] = useState(
    SUPUESTOS_DEFAULT.precioUnitarioMarca,
  );
  const [precioVentaFestival, setPrecioVenta] = useState(
    SUPUESTOS_DEFAULT.precioVentaFestival,
  );
  const [unidadesPorPersonaDia, setConsumo] = useState(
    SUPUESTOS_DEFAULT.unidadesPorPersonaDia,
  );

  const r = analizarProducto({
    montoEnProducto,
    aforo,
    dias,
    precioUnitarioMarca,
    precioVentaFestival,
    unidadesPorPersonaDia,
  });
  const deal = valorRealDelDeal(montoEfectivo, r);
  const conviene = deal.valorReal >= deal.valorNominal;

  return (
    <div className="space-y-5">
      {/* Veredicto principal */}
      <div
        className={`rounded-md border p-4 ${
          conviene
            ? "border-success/65 bg-success/10"
            : "border-warning/65 bg-warning/10"
        }`}
      >
        <Metric
          label="Valor real del deal"
          value={formatMXN(deal.valorReal)}
          detail={
            <>
              Se presenta como {formatMXN(deal.valorNominal)} ·{" "}
              <span className={conviene ? "text-success" : "text-warning"}>
                vale {formatMXN(Math.abs(deal.diferencia))} {conviene ? "más" : "menos"}
              </span>
            </>
          }
        />
      </div>

      {/* Liquidez */}
      {r.seLiquidaCompleto ? (
        <Alert tone="success" title="El producto se puede hacer líquido completo">
          Las {nf.format(Math.round(r.unidadesRecibidas))} unidades caben en el
          consumo esperado del evento ({nf.format(r.capacidadVenta)}).
        </Alert>
      ) : (
        <Alert tone="warning" title="Sobra producto que no se vuelve dinero">
          Te dan {nf.format(Math.round(r.unidadesRecibidas))} unidades y el evento
          solo absorbe {nf.format(r.capacidadVenta)}. Sobran{" "}
          {nf.format(Math.round(r.unidadesSobrantes))} unidades ={" "}
          {formatMXN(r.valorMuerto)} de valor declarado.
        </Alert>
      )}

      <div className="rounded-md border border-line-subtle bg-sunken/60 p-3">
        <Metric
          label="Máximo recomendado en producto"
          value={formatMXN(r.montoMaximoRecomendado)}
          size="sm"
          detail="Arriba de eso, el producto extra ya no se alcanza a vender en este evento."
        />
      </div>

      {/* Números */}
      <dl className="space-y-0">
        <Fila
          label="Unidades que entregan"
          valor={nf.format(Math.round(r.unidadesRecibidas))}
        />
        <Fila
          label="Se pueden vender"
          valor={nf.format(Math.round(r.unidadesVendibles))}
        />
        <Fila label="Ingreso por esa venta" valor={formatMXN(r.ingresoEstimado)} destacado />
        <Fila
          label="Múltiplo sobre lo declarado"
          valor={`${r.multiploSobreDeclarado.toFixed(2)}×`}
        />
      </dl>
      <p className="text-xs text-fg-subtle">
        Todo ese ingreso es margen: el producto no costó, fue parte del pago.
      </p>

      {/* Supuestos editables */}
      <details className="rounded-md border border-line-subtle bg-sunken/40 p-3">
        <summary className="cursor-pointer text-2xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">
          Supuestos · edítalos
        </summary>
        <p className="mb-3 mt-2 text-xs text-fg-subtle">
          Estos tres números son un punto de partida inventado, no datos
          históricos. Cámbialos y el análisis se recalcula.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="La marca lo valúa en">
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                step={1}
                value={precioUnitarioMarca || ""}
                onChange={(e) => setPrecioMarca(Number(e.target.value))}
              />
            )}
          </Field>
          <Field label="Lo vendemos en">
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                step={1}
                value={precioVentaFestival || ""}
                onChange={(e) => setPrecioVenta(Number(e.target.value))}
              />
            )}
          </Field>
          <Field label="Consumo por persona/día">
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                step={0.5}
                value={unidadesPorPersonaDia || ""}
                onChange={(e) => setConsumo(Number(e.target.value))}
              />
            )}
          </Field>
        </div>
      </details>
    </div>
  );
}

function Fila({
  label,
  valor,
  destacado = false,
}: {
  label: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-subtle py-2 last:border-b-0">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className={destacado ? "text-sm font-semibold text-primary" : "text-sm text-fg"}>
        {valor}
      </dd>
    </div>
  );
}
