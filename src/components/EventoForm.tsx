"use client";

import { useState, type FormEvent } from "react";
import {
  ACTIVACION_OPTIONS,
  AFORO_MAX,
  CIUDAD_TIER_OPTIONS,
  DIAS_MAX,
  LINEUP_OPTIONS,
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

      <button
        type="submit"
        className="w-full rounded-md bg-aforo-accent px-4 py-2.5 text-sm font-semibold text-aforo-bg transition-colors hover:brightness-110"
      >
        Calcular rango sugerido
      </button>
    </form>
  );
}
