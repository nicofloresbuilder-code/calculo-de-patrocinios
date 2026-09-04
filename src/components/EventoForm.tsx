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
import {
  Button,
  Checkbox,
  Field,
  Input,
  SegmentedControl,
  Select,
} from "@/components/ui";

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

const TERRITORIO_OPTIONS = TERRITORIO_PRESETS.map((lado) => ({
  value: lado as number,
  label: `${lado}×${lado}`,
}));

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
    // Solo se revalida en vivo después del primer intento: no se le grita al
    // usuario mientras todavía está escribiendo el primer campo.
    if (touched) setErrors(validateEvento(next));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    const currentErrors = validateEvento(form);
    setErrors(currentErrors);
    if (Object.keys(currentErrors).length > 0) return;
    onSubmit?.(form);
  }

  const errorCount = touched ? Object.keys(errors).length : 0;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Field label="Nombre del evento" error={errors.nombre_evento}>
        {(p) => (
          <Input
            {...p}
            type="text"
            value={form.nombre_evento}
            maxLength={120}
            placeholder="Ej. Ultra México 2026"
            onChange={(e) => handleChange("nombre_evento", e.target.value)}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Aforo" error={errors.aforo}>
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              value={form.aforo || ""}
              min={1}
              max={AFORO_MAX}
              step={1}
              placeholder="45000"
              onChange={(e) => handleChange("aforo", Math.trunc(Number(e.target.value)))}
            />
          )}
        </Field>

        <Field label="Duración (días)" error={errors.dias}>
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              value={form.dias || ""}
              min={1}
              max={DIAS_MAX}
              step={1}
              onChange={(e) => handleChange("dias", Math.trunc(Number(e.target.value)))}
            />
          )}
        </Field>
      </div>

      <Field label="Calibre del line-up" error={errors.lineup}>
        {(p) => (
          <Select
            {...p}
            options={LINEUP_OPTIONS}
            value={form.lineup}
            onChange={(e) =>
              handleChange("lineup", e.target.value as EventoInput["lineup"])
            }
          />
        )}
      </Field>

      <Field label="Tipo de activación" error={errors.activacion}>
        {(p) => (
          <Select
            {...p}
            options={ACTIVACION_OPTIONS}
            value={form.activacion}
            onChange={(e) =>
              handleChange("activacion", e.target.value as EventoInput["activacion"])
            }
          />
        )}
      </Field>

      <Field label="Ciudad / venue" error={errors.ciudad_tier}>
        {(p) => (
          <Select
            {...p}
            options={CIUDAD_TIER_OPTIONS}
            value={form.ciudad_tier}
            onChange={(e) =>
              handleChange("ciudad_tier", e.target.value as EventoInput["ciudad_tier"])
            }
          />
        )}
      </Field>

      <Checkbox
        label="Exclusividad de categoría"
        checked={form.exclusiva}
        onCheckedChange={(v) => handleChange("exclusiva", v)}
      />

      <div className="space-y-2">
        <Field
          label="Territorio de la activación"
          error={errors.territorio_lado}
          suffix={`m por lado · ${(form.territorio_lado || 0) ** 2} m²`}
        >
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="decimal"
              value={form.territorio_lado || ""}
              min={TERRITORIO_MIN}
              max={TERRITORIO_MAX}
              step={0.5}
              onChange={(e) => handleChange("territorio_lado", Number(e.target.value))}
            />
          )}
        </Field>
        {/* Atajos a los tamaños habituales; el campo de arriba sigue siendo libre */}
        <SegmentedControl
          label="Tamaños de activación habituales"
          options={TERRITORIO_OPTIONS}
          value={form.territorio_lado}
          onChange={(lado) => handleChange("territorio_lado", lado)}
        />
      </div>

      <div className="space-y-3 rounded-md border border-line-subtle p-3">
        <Checkbox
          label="Paga parte con producto"
          checked={form.paga_con_producto}
          onCheckedChange={(v) => handleChange("paga_con_producto", v)}
        />
        {form.paga_con_producto && (
          <Field
            label="¿Cuánto del deal llega en producto?"
            error={errors.monto_producto}
            hint="A valor declarado por la marca. Abajo verás si de verdad se puede hacer líquido."
          >
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                value={form.monto_producto || ""}
                min={0}
                step={10_000}
                placeholder="500000"
                onChange={(e) => handleChange("monto_producto", Number(e.target.value))}
              />
            )}
          </Field>
        )}
      </div>

      <Button type="submit" variant="primary" size="lg" block>
        Calcular rango sugerido
      </Button>

      {/* Resumen de validación anunciado a lectores de pantalla (WCAG 4.1.3) */}
      <p role="status" aria-live="polite" className="sr-only">
        {errorCount > 0
          ? `El formulario tiene ${errorCount} ${errorCount === 1 ? "error" : "errores"}.`
          : ""}
      </p>
    </form>
  );
}
