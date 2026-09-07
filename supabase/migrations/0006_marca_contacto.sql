-- ============================================================================
-- Marca y contacto en las cotizaciones
--
-- ESTADO: ESCRITA, NO APLICADA. Correr después de 0001/0002/0003.
-- Es independiente de 0004 y 0005.
--
-- Por qué: una cotización guardada sin destinatario no se puede buscar ni
-- auditar después. `nombre_evento` dice QUÉ se cotizó, pero no A QUIÉN.
--
-- IMPORTANTE: estos campos son DATO COMERCIAL, no variables de precio.
-- `computePrice()` no los recibe y el número no cambia por escribirlos. No
-- agregarlos a la fórmula sin pasar por el proceso de calibración de
-- DECISIONS.md.
-- ============================================================================

alter table cotizaciones
  add column if not exists marca text,
  add column if not exists contacto text;

comment on column cotizaciones.marca is
  'Marca a la que se le cotizó. Dato comercial, no variable de precio.';
comment on column cotizaciones.contacto is
  'Persona de contacto en la marca. Opcional: se cotiza antes de saber con quién se trata.';

-- Las cotizaciones anteriores a esta columna no tienen marca registrada. Se
-- deja NULL en vez de inventar un valor: NULL significa "no se registró",
-- que es el hecho. Un texto de relleno como 'Sin marca' se confundiría con
-- una marca real en las búsquedas.

-- La marca es obligatoria de aquí en adelante, pero la restricción NOT NULL
-- se aplica solo a los renglones nuevos para no romper el histórico.
alter table cotizaciones
  add constraint cotizaciones_marca_presente
  check (marca is null or length(trim(marca)) > 0)
  not valid;

-- Búsqueda por marca y por contacto. `gin_trgm_ops` permite que un ILIKE
-- '%texto%' use el índice; sin esto, la búsqueda haría scan completo en
-- cuanto la tabla crezca.
create extension if not exists pg_trgm;

create index if not exists cotizaciones_marca_busqueda
  on cotizaciones using gin (marca gin_trgm_ops);
create index if not exists cotizaciones_contacto_busqueda
  on cotizaciones using gin (contacto gin_trgm_ops);
create index if not exists cotizaciones_evento_busqueda
  on cotizaciones using gin (nombre_evento gin_trgm_ops);

-- El listado ordena por fecha descendente y filtra por usuario: este índice
-- cubre exactamente esa consulta.
create index if not exists cotizaciones_usuario_fecha
  on cotizaciones (user_id, creado_en desc);
