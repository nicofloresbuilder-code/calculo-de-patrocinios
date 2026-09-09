-- ============================================================================
-- CATÁLOGO DE EVENTOS
--
-- ESTADO: ESCRITA, NO APLICADA. Correr después de 0004 y 0005.
--
-- Por qué: hoy cada cotización se captura desde cero, y un mismo evento se le
-- cotiza a varias marcas. Eso significa reescribir aforo, días, line-up y
-- ciudad una y otra vez — trabajo repetido y, peor, la puerta a que dos
-- cotizaciones del mismo evento salgan con datos distintos porque alguien
-- tecleó 15,000 en una y 15,00 en otra.
--
-- El administrador carga el evento una vez; el comercial lo elige.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- 1. La tabla
--
-- Qué es del EVENTO y qué es del DEAL: el evento define aforo, días,
-- line-up y ciudad —no cambian según a quién se le cotice—. La
-- exclusividad, el tipo de activación, el territorio y el pago en producto
-- se negocian con cada marca, así que NO viven aquí: siguen en la
-- cotización.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  aforo integer not null check (aforo > 0 and aforo <= 500000),
  dias integer not null check (dias > 0 and dias <= 30),
  lineup text not null check (lineup in ('A','B','C')),
  ciudad text,
  ciudad_tier text not null check (ciudad_tier in ('tier1','tier2','tier3')),
  fecha_inicio date,
  notas text,
  -- Baja lógica, igual que con los usuarios: un evento que ya pasó no se
  -- borra. Sus cotizaciones son historial comercial y tienen que seguir
  -- diciendo de qué evento hablaban.
  activo boolean not null default true,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint eventos_nombre_presente check (length(trim(nombre)) > 0)
);

comment on table eventos is
  'Catálogo de eventos que se cotizan. Un evento se cotiza a varias marcas. Escritura solo vía /api/eventos, que verifica permisos server-side.';
comment on column eventos.activo is
  'Baja lógica. Un evento inactivo no aparece en el cotizador pero conserva sus cotizaciones.';
comment on column eventos.ciudad is
  'Nombre de la ciudad, informativo. Lo que entra en la fórmula es ciudad_tier.';

-- El cotizador lista los activos por nombre; el índice cubre esa consulta.
create index if not exists eventos_activos_nombre on eventos (activo, nombre);

create extension if not exists pg_trgm;
create index if not exists eventos_nombre_busqueda
  on eventos using gin (nombre gin_trgm_ops);

drop trigger if exists eventos_actualizado_en on eventos;
create trigger eventos_actualizado_en
  before update on eventos
  for each row execute function tocar_actualizado_en();


-- ─────────────────────────────────────────────────────────────────────────
-- 2. La cotización apunta al evento, pero NO depende de él
--
-- Decisión de producto (Nicolás, 2026-09-09): si mañana se corrige el aforo
-- de un evento, las cotizaciones ya enviadas NO cambian.
--
-- Por eso `cotizaciones` conserva su propia copia de aforo, días, line-up y
-- ciudad_tier: son la foto de con qué datos se calculó ese precio. Sin la
-- copia, un ajuste al catálogo cambiaría retroactivamente el precio de una
-- cotización que la marca ya tiene en su bandeja, y no habría manera de
-- explicar de dónde salió el número original.
--
-- `evento_id` es solo la referencia: sirve para saber qué se le cotizó a
-- quién y agrupar. `on delete set null` porque el evento no se borra, pero
-- si alguien lo forzara, la cotización sobrevive con su foto intacta.
-- ─────────────────────────────────────────────────────────────────────────

alter table cotizaciones
  add column if not exists evento_id uuid references eventos(id) on delete set null;

comment on column cotizaciones.evento_id is
  'Evento del catálogo del que salió esta cotización, si vino de ahí. Los datos del evento están COPIADOS en esta misma fila: editar el catálogo no reescribe cotizaciones ya hechas.';

create index if not exists cotizaciones_evento_idx on cotizaciones (evento_id);


-- ─────────────────────────────────────────────────────────────────────────
-- 3. Permisos nuevos
--
-- Idempotente a propósito: este archivo se va a pegar dos veces tarde o
-- temprano. Tiene que coincidir con PERMISSIONS y ROLE_PERMISSIONS en
-- src/lib/auth/permissions.ts.
-- ─────────────────────────────────────────────────────────────────────────

insert into permisos (recurso, accion, descripcion) values
  ('events', 'view',   'Ver el catálogo de eventos'),
  ('events', 'create', 'Dar de alta eventos'),
  ('events', 'edit',   'Editar eventos'),
  ('events', 'delete', 'Desactivar eventos')
on conflict (recurso, accion) do nothing;

-- SUPER_ADMIN tiene todo el catálogo por definición: se le vuelven a dar
-- todos los permisos, y los que ya tenía chocan y se ignoran.
insert into rol_permisos (rol_id, permiso_id)
select r.id, p.id from roles r cross join permisos p where r.nombre = 'SUPER_ADMIN'
on conflict do nothing;

insert into rol_permisos (rol_id, permiso_id)
select r.id, p.id
from roles r
join permisos p on (r.nombre, p.recurso, p.accion) in (
  -- Quien administra el catálogo
  ('ADMIN','events','view'),   ('ADMIN','events','create'),
  ('ADMIN','events','edit'),   ('ADMIN','events','delete'),

  ('MANAGER','events','view'), ('MANAGER','events','create'),
  ('MANAGER','events','edit'),

  -- El resto solo elige del catálogo para cotizar. `events.view` es lo que
  -- hace que el selector del cotizador tenga contenido.
  ('COMMERCIAL','events','view'),
  ('OPERATIONS','events','view'),
  ('VIEWER','events','view')
)
on conflict do nothing;


-- ─────────────────────────────────────────────────────────────────────────
-- 4. Row Level Security
--
-- Lectura: cualquier sesión iniciada, igual que `comparables` después de
-- 0005. No se usa `tiene_permiso(auth.uid(), 'events.view')` a propósito:
-- hoy el rol de la aplicación todavía sale del bootstrap por correo
-- (AFORO_SUPER_ADMIN_EMAILS), no de `usuario_roles`, así que una policy
-- basada en la tabla dejaría el catálogo vacío para usuarios que la
-- aplicación sí considera autorizados. El filtro por permiso lo aplica el
-- servidor. Cuando getAuthzContext() lea de `perfiles`, esta policy se
-- puede endurecer a tiene_permiso().
--
-- Escritura: ninguna policy, y además revocada. Toda alta o cambio pasa por
-- /api/eventos, que verifica el permiso del lado del servidor. Es la misma
-- decisión que en `cotizaciones` (0005): sin esto, cualquiera con una
-- sesión válida podría escribir en la tabla directo contra la REST API de
-- Supabase, saltándose la comprobación de permisos.
-- ─────────────────────────────────────────────────────────────────────────

alter table eventos enable row level security;

drop policy if exists "eventos: solo con sesión iniciada" on eventos;
create policy "eventos: solo con sesión iniciada"
  on eventos for select
  using (auth.uid() is not null);

revoke insert, update, delete on eventos from authenticated;
revoke all on eventos from anon;
grant select on eventos to authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 5. Verificación — correr después y revisar que dé lo esperado
-- ─────────────────────────────────────────────────────────────────────────

-- Debe dar 22 permisos (18 + los 4 de eventos)
-- select count(*) as permisos from permisos;

-- Debe dar 0: ninguna tabla del esquema public sin RLS
-- select count(*) from pg_tables t
--   join pg_class c on c.relname = t.tablename
--  where t.schemaname = 'public' and not c.relrowsecurity;

-- Debe dar 0: nadie escribe eventos directo desde el navegador
-- select count(*) from information_schema.role_table_grants
--  where table_name = 'eventos' and grantee = 'authenticated'
--    and privilege_type in ('INSERT','UPDATE','DELETE');
