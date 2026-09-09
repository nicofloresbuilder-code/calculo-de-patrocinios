"use client";

import { useState, type FormEvent } from "react";
import {
  AFORO_MAX,
  CIUDAD_MAX,
  CIUDAD_TIER_OPTIONS,
  DIAS_MAX,
  EVENTO_NOMBRE_MAX,
  LINEUP_OPTIONS,
  NOTAS_MAX,
  type EventoCatalogo,
  type EventoCatalogoInput,
} from "@/lib/types";
import {
  validateEventoCatalogo,
  type EventoCatalogoErrors,
} from "@/lib/validateEventoCatalogo";
import { Alert, Button, Field, Input, Select, controlClass } from "@/components/ui";

export const EVENTO_VACIO: EventoCatalogoInput = {
  nombre: "",
  aforo: 0,
  dias: 1,
  lineup: "B",
  ciudad: "",
  ciudad_tier: "tier1",
  fecha_inicio: "",
  notas: "",
};

export function eventoAFormulario(evento: EventoCatalogo): EventoCatalogoInput {
  return {
    nombre: evento.nombre,
    aforo: evento.aforo,
    dias: evento.dias,
    lineup: evento.lineup,
    ciudad: evento.ciudad,
    ciudad_tier: evento.ciudad_tier,
    fecha_inicio: evento.fecha_inicio,
    notas: evento.notas,
  };
}

/**
 * Alta y edición de un evento del catálogo. Mismo formulario para las dos
 * cosas: lo único que cambia es qué trae cargado y a dónde manda.
 *
 * Aquí NO se piden exclusividad, tipo de activación, territorio ni pago en
 * producto. Eso se negocia con cada marca y vive en la cotización, no en el
 * evento.
 */
export function EventoCatalogoForm({
  inicial = EVENTO_VACIO,
  enviando,
  errorServidor,
  erroresServidor,
  textoAccion,
  onSubmit,
  onCancel,
}: {
  inicial?: EventoCatalogoInput;
  enviando: boolean;
  errorServidor?: string | null;
  erroresServidor?: EventoCatalogoErrors | null;
  textoAccion: string;
  onSubmit: (evento: EventoCatalogoInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EventoCatalogoInput>(inicial);
  const [errors, setErrors] = useState<EventoCatalogoErrors>({});
  const [touched, setTouched] = useState(false);

  function handleChange<K extends keyof EventoCatalogoInput>(
    key: K,
    value: EventoCatalogoInput[K],
  ) {
    const next = { ...form, [key]: value };
    setForm(next);
    if (touched) setErrors(validateEventoCatalogo(next));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    const actuales = validateEventoCatalogo(form);
    setErrors(actuales);
    if (Object.keys(actuales).length > 0) return;
    onSubmit(form);
  }

  // El servidor vuelve a validar y puede rechazar algo que aquí pasó: sus
  // mensajes tienen prioridad sobre los locales.
  const verError = (campo: keyof EventoCatalogoInput) =>
    erroresServidor?.[campo] ?? errors[campo];

  const errorCount = touched ? Object.keys(errors).length : 0;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {errorServidor && (
        <Alert tone="danger" title="No se pudo guardar">
          {errorServidor}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Nombre del evento"
          error={verError("nombre")}
          className="sm:col-span-2"
        >
          {(p) => (
            <Input
              {...p}
              type="text"
              value={form.nombre}
              maxLength={EVENTO_NOMBRE_MAX}
              placeholder="Ej. Ultra México 2026"
              onChange={(e) => handleChange("nombre", e.target.value)}
            />
          )}
        </Field>

        <Field label="Aforo" error={verError("aforo")}>
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

        <Field label="Duración (días)" error={verError("dias")}>
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

        <Field label="Calibre del line-up" error={verError("lineup")}>
          {(p) => (
            <Select
              {...p}
              options={LINEUP_OPTIONS}
              value={form.lineup}
              onChange={(e) =>
                handleChange("lineup", e.target.value as EventoCatalogoInput["lineup"])
              }
            />
          )}
        </Field>

        <Field label="Ciudad / venue" error={verError("ciudad_tier")}>
          {(p) => (
            <Select
              {...p}
              options={CIUDAD_TIER_OPTIONS}
              value={form.ciudad_tier}
              onChange={(e) =>
                handleChange(
                  "ciudad_tier",
                  e.target.value as EventoCatalogoInput["ciudad_tier"],
                )
              }
            />
          )}
        </Field>

        <Field
          label="Ciudad (opcional)"
          error={verError("ciudad")}
          hint="Solo informativo. Lo que entra en la fórmula es el tier."
        >
          {(p) => (
            <Input
              {...p}
              type="text"
              value={form.ciudad}
              maxLength={CIUDAD_MAX}
              placeholder="Ej. Guadalajara"
              onChange={(e) => handleChange("ciudad", e.target.value)}
            />
          )}
        </Field>

        <Field
          label="Fecha de inicio (opcional)"
          error={verError("fecha_inicio")}
          hint="Muchos eventos se cotizan antes de tener fecha firme."
        >
          {(p) => (
            <Input
              {...p}
              type="date"
              value={form.fecha_inicio}
              onChange={(e) => handleChange("fecha_inicio", e.target.value)}
            />
          )}
        </Field>

        <Field
          label="Notas internas (opcional)"
          error={verError("notas")}
          className="sm:col-span-2"
        >
          {(p) => (
            <textarea
              {...p}
              value={form.notas}
              maxLength={NOTAS_MAX}
              rows={3}
              placeholder="Lo que el equipo necesita saber al cotizar este evento."
              className={`${controlClass} h-auto py-2`}
              onChange={(e) => handleChange("notas", e.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" loading={enviando}>
          {textoAccion}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={enviando}>
          Cancelar
        </Button>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {errorCount > 0
          ? `El formulario tiene ${errorCount} ${errorCount === 1 ? "error" : "errores"}.`
          : ""}
      </p>
    </form>
  );
}
