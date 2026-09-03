"use client";

import { useState, type FormEvent } from "react";
import {
  ACTIVACION_OPTIONS,
  AFORO_MAX,
  CIUDAD_TIER_OPTIONS,
  DIAS_MAX,
  LINEUP_OPTIONS,
  TERRITORIO_MAX,
  TERRITORIO_MIN,
  TERRITORIO_PRESETS,
  type EventoInput,
} from "@/lib/types";
import { validateEvento, type EventoErrors } from "@/lib/validateEvento";

const initialForm: EventoInput = {
  nombre_evento: "",
  aforo: 0,
  dias: 1,
  lineup: "B",
  exclusiva: false,
  activacion: "oficial",
  ciudad_tier: "tier1",
  territorio_lado: 5,
  paga_con_producto: false,
  monto_producto: 0,
};

const inputClass =
  "w-full rounded-md border border-aforo-panel-border bg-aforo-input px-3 py-2.5 text-sm text-aforo-fg outline-none focus:border-aforo-accent";
const labelClass = "mb-1.5 block text-xs text-aforo-fg-muted";
const errorClass = "mt-1 text-xs text-red-400";

export function EventoForm({
  onSubmit,
}: {
  onSubmit?: (evento: EventoInput) => void;
}) {
  const [form, setForm] = useState<EventoInput>(initialForm);
  const [errors, setErrors] = useState<EventoErrors>({});
  const [touched, setTouched] = useState(false);

  function handleChange<K extends keyof EventoInput>(key: K, value: EventoInput[K]) {
    const next = { ...form, [key]: value };
    setForm(next);
    if (touched) setErrors(validateEvento(next));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    const currentErrors = validateEvento(form);
    setErrors(currentErrors);
    if (Object.keys(currentErrors).length > 0) return;

    // Commit 3: todavía sin fórmula — solo se loguea el objeto.
    console.log("Evento a cotizar:", form);
    onSubmit?.(form);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="nombre_evento">
          Nombre del evento
        </label>
        <input
          id="nombre_evento"
          type="text"
          className={inputClass}
          value={form.nombre_evento}
          maxLength={120}
          placeholder="Ej. Ultra México 2026"
          onChange={(e) => handleChange("nombre_evento", e.target.value)}
        />
        {errors.nombre_evento && <p className={errorClass}>{errors.nombre_evento}</p>}
      </div>

      <div>
        <label className={labelClass} htmlFor="aforo">
          Aforo (capacidad)
        </label>
        <input
          id="aforo"
          type="number"
          className={inputClass}
          value={form.aforo || ""}
          min={1}
          max={AFORO_MAX}
          step={1}
          placeholder="45,000"
          onChange={(e) => handleChange("aforo", Math.trunc(Number(e.target.value)))}
        />
        {errors.aforo && <p className={errorClass}>{errors.aforo}</p>}
      </div>

      <div>
        <label className={labelClass} htmlFor="dias">
          Duración (días)
        </label>
        <input
          id="dias"
          type="number"
          className={inputClass}
          value={form.dias || ""}
          min={1}
          max={DIAS_MAX}
          step={1}
          onChange={(e) => handleChange("dias", Math.trunc(Number(e.target.value)))}
        />
        {errors.dias && <p className={errorClass}>{errors.dias}</p>}
      </div>

      <div>
        <label className={labelClass} htmlFor="lineup">
          Caliber del line-up
        </label>
        <select
          id="lineup"
          className={inputClass}
          value={form.lineup}
          onChange={(e) => handleChange("lineup", e.target.value as EventoInput["lineup"])}
        >
          {LINEUP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between rounded-md border border-aforo-panel-border bg-aforo-input px-3 py-2.5">
        <label htmlFor="exclusiva" className="text-sm text-aforo-fg">
          Exclusividad de categoría
        </label>
        <input
          id="exclusiva"
          type="checkbox"
          className="h-4 w-4 accent-aforo-accent"
          checked={form.exclusiva}
          onChange={(e) => handleChange("exclusiva", e.target.checked)}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="activacion">
          Tipo de activación
        </label>
        <select
          id="activacion"
          className={inputClass}
          value={form.activacion}
          onChange={(e) =>
            handleChange("activacion", e.target.value as EventoInput["activacion"])
          }
        >
          {ACTIVACION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="ciudad_tier">
          Ciudad / venue
        </label>
        <select
          id="ciudad_tier"
          className={inputClass}
          value={form.ciudad_tier}
          onChange={(e) =>
            handleChange("ciudad_tier", e.target.value as EventoInput["ciudad_tier"])
          }
        >
          {CIUDAD_TIER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="territorio_lado">
          Territorio de la activación
        </label>
        <div className="mb-2 flex gap-1.5">
          {TERRITORIO_PRESETS.map((lado) => (
            <button
              key={lado}
              type="button"
              onClick={() => handleChange("territorio_lado", lado)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                form.territorio_lado === lado
                  ? "border-aforo-accent bg-aforo-accent/15 text-aforo-accent"
                  : "border-aforo-panel-border bg-aforo-input text-aforo-fg-muted hover:border-aforo-accent/50"
              }`}
            >
              {lado}×{lado}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            id="territorio_lado"
            type="number"
            className={inputClass}
            value={form.territorio_lado || ""}
            min={TERRITORIO_MIN}
            max={TERRITORIO_MAX}
            step={0.5}
            onChange={(e) => handleChange("territorio_lado", Number(e.target.value))}
          />
          <span className="whitespace-nowrap text-xs text-aforo-fg-muted">
            m por lado · {(form.territorio_lado || 0) ** 2} m²
          </span>
        </div>
        {errors.territorio_lado && <p className={errorClass}>{errors.territorio_lado}</p>}
      </div>

      <div className="space-y-3 rounded-md border border-aforo-panel-border bg-aforo-input/50 p-3">
        <div className="flex items-center justify-between">
          <label htmlFor="paga_con_producto" className="text-sm text-aforo-fg">
            Paga parte con producto
          </label>
          <input
            id="paga_con_producto"
            type="checkbox"
            className="h-4 w-4 accent-aforo-accent"
            checked={form.paga_con_producto}
            onChange={(e) => handleChange("paga_con_producto", e.target.checked)}
          />
        </div>

        {form.paga_con_producto && (
          <div>
            <label className={labelClass} htmlFor="monto_producto">
              ¿Cuánto del deal llega en producto?
            </label>
            <input
              id="monto_producto"
              type="number"
              className={inputClass}
              value={form.monto_producto || ""}
              min={0}
              step={10_000}
              placeholder="500,000"
              onChange={(e) => handleChange("monto_producto", Number(e.target.value))}
            />
            <p className="mt-1 text-xs text-aforo-fg-muted">
              A valor declarado por la marca. Abajo verás si de verdad se puede
              hacer líquido.
            </p>
            {errors.monto_producto && <p className={errorClass}>{errors.monto_producto}</p>}
          </div>
        )}
      </div>

      <button
        type="submit"
        className="w-full rounded-md bg-aforo-accent px-4 py-2.5 text-sm font-semibold text-aforo-bg transition-colors hover:brightness-110"
      >
        Calcular rango sugerido
      </button>
    </form>
  );
}
