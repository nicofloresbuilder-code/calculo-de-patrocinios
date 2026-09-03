-- Territorio de activación + pago en especie (producto).
--
-- Sin estas columnas, una cotización guardada pierde dos de las variables
-- que determinaron su precio — y deja de ser reproducible desde lo
-- guardado, que es justo lo que hace defendible el número frente a la
-- marca. Por eso se guardan, no solo se calculan.
--
-- IMPORTANTE: correr esto en el SQL Editor de Supabase ANTES de que
-- "Guardar cotización" vuelva a funcionar (hoy está bloqueado por el
-- pendiente de Google OAuth, así que no hay regresión mientras tanto).

alter table cotizaciones
  add column if not exists territorio_lado numeric,
  add column if not exists paga_con_producto boolean not null default false,
  add column if not exists monto_producto numeric;

-- Las cotizaciones viejas se guardaron cuando el territorio no existía como
-- variable; en ese momento la fórmula equivalía a un 5x5 (ver la nota de
-- calibración en src/lib/pricing.ts). Se deja explícito en vez de NULL para
-- que no se lean como "sin territorio".
update cotizaciones set territorio_lado = 5 where territorio_lado is null;

comment on column cotizaciones.territorio_lado is
  'Lado en metros del espacio de activación (5 = 5x5 m). Anterior a esta columna, la fórmula asumía 5x5.';
comment on column cotizaciones.monto_producto is
  'Parte del deal pagada en producto, a valor declarado por la marca (no lo que se estima vender).';
