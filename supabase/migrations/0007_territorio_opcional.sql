-- ============================================================================
-- Territorio opcional
--
-- ESTADO: ESCRITA, NO APLICADA. Correr después de 0006.
--
-- Por qué: no todo patrocinio incluye espacio físico. Una marca puede querer
-- solo presencia (logo, menciones, branding). Antes el territorio era
-- obligatorio y bloqueaba esas cotizaciones.
-- ============================================================================

alter table cotizaciones
  add column if not exists tiene_territorio boolean not null default true;

comment on column cotizaciones.tiene_territorio is
  'Si el patrocinio incluye espacio físico de activación. false = solo presencia.';

-- `territorio_lado` pasa a ser NULL cuando no hay espacio físico. Las
-- cotizaciones anteriores a esta columna sí tenían territorio (era
-- obligatorio), por eso el default es true: describe correctamente lo que ya
-- estaba guardado, sin tener que adivinar.

comment on column cotizaciones.territorio_lado is
  'Lado en metros del espacio de activación (5 = 5x5 m). NULL cuando tiene_territorio es false. Anterior a la columna de territorio, la fórmula asumía 5x5.';
