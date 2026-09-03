"use client";

import { useState } from "react";
import {
  analizarProducto,
  valorRealDelDeal,
  SUPUESTOS_DEFAULT,
} from "@/lib/producto";
import { formatMXN } from "@/lib/format";

const inputClass =
  "w-full rounded-md border border-aforo-panel-border bg-aforo-input px-2.5 py-1.5 text-sm text-aforo-fg outline-none focus:border-aforo-accent";
const labelClass = "mb-1 block text-xs text-aforo-fg-muted";

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
        className={`rounded-md border p-3 ${
          conviene
            ? "border-emerald-500/40 bg-emerald-500/10"
            : "border-amber-500/40 bg-amber-500/10"
        }`}
      >
        <p className="text-xs uppercase tracking-wider text-aforo-fg-muted">
          Valor real del deal
        </p>
        <p className="mt-1 text-2xl font-semibold text-aforo-fg">
          {formatMXN(deal.valorReal)}
        </p>
        <p className="mt-1 text-sm text-aforo-fg-muted">
          El deal se presenta como {formatMXN(deal.valorNominal)} ·{" "}
          <span className={conviene ? "text-emerald-400" : "text-amber-400"}>
            {conviene ? "vale " : "vale "}
            {formatMXN(Math.abs(deal.diferencia))} {conviene ? "más" : "menos"}
          </span>
        </p>
      </div>

      {/* Liquidez */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-aforo-fg-muted">
          ¿Se puede hacer líquido?
        </p>

        {r.seLiquidaCompleto ? (
          <p className="text-sm text-emerald-400">
            Sí — las {nf.format(Math.round(r.unidadesRecibidas))} unidades caben en
            el consumo esperado del evento ({nf.format(r.capacidadVenta)}).
          </p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-sm text-amber-400">
              No del todo — te dan {nf.format(Math.round(r.unidadesRecibidas))}{" "}
              unidades y el evento solo absorbe {nf.format(r.capacidadVenta)}.
            </p>
            <p className="text-sm text-aforo-fg-muted">
              Sobran {nf.format(Math.round(r.unidadesSobrantes))} unidades ={" "}
              <span className="text-amber-400">{formatMXN(r.valorMuerto)}</span>{" "}
              de valor declarado que no se vuelve dinero.
            </p>
          </div>
        )}

        <div className="rounded-md border border-aforo-panel-border bg-aforo-input/40 p-2.5">
          <p className="text-xs text-aforo-fg-muted">Máximo recomendado en producto</p>
          <p className="text-lg font-semibold text-aforo-fg">
            {formatMXN(r.montoMaximoRecomendado)}
          </p>
          <p className="mt-0.5 text-xs text-aforo-fg-muted">
            Arriba de eso, el producto extra ya no se alcanza a vender en este evento.
          </p>
        </div>
      </div>

      {/* Números */}
      <div className="space-y-1.5 text-sm">
        <Fila label="Unidades que entregan" valor={nf.format(Math.round(r.unidadesRecibidas))} />
        <Fila label="Se pueden vender" valor={nf.format(Math.round(r.unidadesVendibles))} />
        <Fila
          label="Ingreso por esa venta"
          valor={formatMXN(r.ingresoEstimado)}
          destacado
        />
        <Fila
          label="Múltiplo sobre lo declarado"
          valor={`${r.multiploSobreDeclarado.toFixed(2)}×`}
        />
      </div>
      <p className="text-xs text-aforo-fg-muted">
        Todo ese ingreso es margen: el producto no costó, fue parte del pago.
      </p>

      {/* Supuestos editables */}
      <details className="rounded-md border border-aforo-panel-border bg-aforo-input/30 p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-aforo-fg-muted">
          Supuestos · edítalos
        </summary>
        <p className="mb-3 mt-2 text-xs text-aforo-fg-muted">
          Estos tres números son un punto de partida inventado, no datos
          históricos. Cámbialos y el análisis se recalcula.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="precio_marca">
              La marca lo valúa en
            </label>
            <input
              id="precio_marca"
              type="number"
              min={0}
              step={1}
              className={inputClass}
              value={precioUnitarioMarca || ""}
              onChange={(e) => setPrecioMarca(Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="precio_venta">
              Lo vendemos en
            </label>
            <input
              id="precio_venta"
              type="number"
              min={0}
              step={1}
              className={inputClass}
              value={precioVentaFestival || ""}
              onChange={(e) => setPrecioVenta(Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="consumo">
              Consumo por persona/día
            </label>
            <input
              id="consumo"
              type="number"
              min={0}
              step={0.5}
              className={inputClass}
              value={unidadesPorPersonaDia || ""}
              onChange={(e) => setConsumo(Number(e.target.value))}
            />
          </div>
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
    <div className="flex items-baseline justify-between gap-3 border-b border-aforo-panel-border/50 pb-1.5">
      <span className="text-aforo-fg-muted">{label}</span>
      <span className={destacado ? "font-semibold text-aforo-accent" : "text-aforo-fg"}>
        {valor}
      </span>
    </div>
  );
}
