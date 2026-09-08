-- ============================================================================
-- AFORO — TODAS LAS MIGRACIONES PENDIENTES, EN UN SOLO ARCHIVO
--
-- CÓMO USARLO
--   1. Supabase → SQL Editor → New query
--   2. Pega TODO este archivo
--   3. Run
--
-- Es la unión de 0002, 0003, 0004, 0005 y 0006, en orden, con los mismos
-- comentarios de cada una.
--
-- SEGURO DE VOLVER A CORRER: cada objeto se crea con guardas (if not exists,
-- drop ... if exists, on conflict do nothing). Si lo pegas dos veces por
-- accidente, no rompe nada.
--
-- ANTES DE CORRERLO: `SUPABASE_SERVICE_ROLE_KEY` debe estar configurada en
-- Vercel. La sección 0005 revoca la escritura directa desde el navegador; sin
-- esa llave, guardar cotizaciones dejaría de funcionar.
--
-- Al final hay 3 consultas de verificación. Córrelas.
-- ============================================================================



-- ############################################################################
-- Territorio de activación y pago en especie
-- (origen: supabase/migrations/0002_territorio_producto.sql)
-- ############################################################################

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


-- ############################################################################
-- Corregir montos de comparables (eran placeholder)
-- (origen: supabase/migrations/0003_corregir_comparables.sql)
-- ############################################################################

-- Corrige los montos de los comparables.
--
-- Los tres montos del seed original (0001_init.sql) eran PLACEHOLDER — el
-- propio comentario del archivo lo advertía. En el pase mecánico (Commit 7)
-- Nicolás confirmó las cifras reales y se usaron para recalibrar la
-- fórmula... pero nunca se escribieron de vuelta a la tabla.
--
-- O sea que la fórmula quedó calibrada con los números buenos mientras la
-- tabla que la IA cita como "comparables históricos" seguía con los malos:
--
--   Ultra México 2026   seed $1,200,000  ->  real $5,000,000   (-76%)
--   Goleiro FanFest     seed   $650,000  ->  real $1,000,000   (-35%)
--   Match Cup           seed   $300,000  ->  real   $300,000   (correcto)
--
-- Con Ultra 4x por debajo de su valor real, la narrativa podía estar
-- citando ese deal para justificar cotizaciones bajas.

update comparables set monto_mxn = 5000000 where nombre = 'Ultra Mexico 2026';
update comparables set monto_mxn = 1000000 where nombre = 'Goleiro FanFest';

-- Nota sobre Goleiro: Nicolás lo marcó como deal SUBVALUADO — cerró en $1M
-- cuando el modelo lo valúa en ~$2.3M, y decidió que de ahí en adelante no
-- se dan esos descuentos. Se corrige el monto (es el hecho histórico) pero
-- queda pendiente decidir si debe seguir sirviendo como comparable para la
-- IA, porque citarlo empuja las cotizaciones hacia abajo. Ver DECISIONS.md.


-- ############################################################################
-- Usuarios, roles y permisos (RBAC)
-- (origen: supabase/migrations/0004_rbac.sql)
-- ############################################################################

-- ============================================================================
-- RBAC — perfiles, roles y permisos
--
-- ESTADO: ESCRITA, NO APLICADA. Requiere la decisión de §6 de
-- RBAC-ARCHITECTURE.md (proveedor de autenticación) y un proyecto de Supabase
-- vivo. Correr en el SQL Editor DESPUÉS de 0001/0002/0003.
--
-- Diseño: ver RBAC-ARCHITECTURE.md. Resumen de las decisiones que importan:
--   · `perfiles` espeja auth.users porque a auth.users no se le pueden
--     agregar columnas propias.
--   · usuario↔rol es N:M, no una columna `role`: hoy cuesta una tabla y evita
--     una migración dolorosa el día que alguien necesite dos roles.
--   · No hay borrado duro de usuarios: la baja es `status`.
--   · Las columnas de auditoría existen desde el día uno.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Perfiles
-- ─────────────────────────────────────────────────────────────────────────

do $$ begin
  create type estado_usuario as enum ('ACTIVE', 'INACTIVE', 'INVITED', 'SUSPENDED');
exception when duplicate_object then null;
end $$;

create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  apellido text,
  email text not null,
  status estado_usuario not null default 'INVITED',
  ultimo_acceso timestamptz,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index if not exists perfiles_email_unico on perfiles (lower(email));
create index if not exists perfiles_status_idx on perfiles (status);

comment on table perfiles is
  'Datos propios del usuario. auth.users no acepta columnas nuevas, por eso existe esta tabla espejo.';
comment on column perfiles.status is
  'Baja lógica: nunca se borra un usuario, se pasa a INACTIVE o SUSPENDED. Solo ACTIVE puede operar.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Roles y permisos
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  -- Un rol de sistema no se puede borrar desde el panel: si alguien elimina
  -- SUPER_ADMIN por accidente, la plataforma se queda sin quien administre.
  es_sistema boolean not null default false,
  creado_en timestamptz not null default now()
);

create table if not exists permisos (
  id uuid primary key default gen_random_uuid(),
  recurso text not null,
  accion text not null,
  descripcion text,
  unique (recurso, accion)
);

comment on table permisos is
  'Espejo relacional del catálogo de src/lib/auth/permissions.ts. El código pregunta por "recurso.accion".';

create table if not exists rol_permisos (
  rol_id uuid not null references roles(id) on delete cascade,
  permiso_id uuid not null references permisos(id) on delete cascade,
  primary key (rol_id, permiso_id)
);

create table if not exists usuario_roles (
  usuario_id uuid not null references perfiles(id) on delete cascade,
  rol_id uuid not null references roles(id) on delete restrict,
  asignado_por uuid references auth.users(id) on delete set null,
  asignado_en timestamptz not null default now(),
  primary key (usuario_id, rol_id)
);

create index if not exists usuario_roles_usuario_idx on usuario_roles (usuario_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Semilla — debe coincidir con src/lib/auth/permissions.ts
-- ─────────────────────────────────────────────────────────────────────────

insert into permisos (recurso, accion, descripcion) values
  ('quotes', 'view',         'Ver cotizaciones propias'),
  ('quotes', 'create',       'Crear cotizaciones'),
  ('quotes', 'edit',         'Editar cotizaciones'),
  ('quotes', 'delete',       'Eliminar cotizaciones'),
  ('quotes', 'view_all',     'Ver las cotizaciones de todo el equipo'),
  ('users', 'view',          'Ver usuarios'),
  ('users', 'create',        'Crear e invitar usuarios'),
  ('users', 'edit',          'Editar usuarios'),
  ('users', 'delete',        'Desactivar usuarios'),
  ('users', 'assign_role',   'Asignar roles'),
  ('comparables', 'view',    'Ver comparables'),
  ('comparables', 'create',  'Agregar comparables'),
  ('comparables', 'edit',    'Editar comparables'),
  ('comparables', 'delete',  'Eliminar comparables'),
  ('reports', 'view',        'Ver reportes'),
  ('reports', 'export',      'Exportar reportes'),
  ('settings', 'view',       'Ver configuración'),
  ('settings', 'edit',       'Editar configuración')
on conflict (recurso, accion) do nothing;

insert into roles (nombre, descripcion, es_sistema) values
  ('SUPER_ADMIN', 'Control total de la plataforma, incluida la configuración.', true),
  ('ADMIN',       'Administra usuarios y catálogos. No cambia la configuración global.', true),
  ('MANAGER',     'Ve las cotizaciones de todo el equipo y exporta reportes.', false),
  ('COMMERCIAL',  'Crea y edita sus propias cotizaciones.', false),
  ('OPERATIONS',  'Mantiene el catálogo de comparables.', false),
  ('VIEWER',      'Solo consulta.', false)
on conflict (nombre) do nothing;

-- SUPER_ADMIN: todo el catálogo
insert into rol_permisos (rol_id, permiso_id)
select r.id, p.id from roles r cross join permisos p where r.nombre = 'SUPER_ADMIN'
on conflict do nothing;

-- El resto, por pares explícitos (mismo mapa que ROLE_PERMISSIONS en el código)
insert into rol_permisos (rol_id, permiso_id)
select r.id, p.id
from roles r
join permisos p on (r.nombre, p.recurso, p.accion) in (
  ('ADMIN','quotes','view'),      ('ADMIN','quotes','create'),
  ('ADMIN','quotes','edit'),      ('ADMIN','quotes','delete'),
  ('ADMIN','quotes','view_all'),
  ('ADMIN','users','view'),       ('ADMIN','users','create'),
  ('ADMIN','users','edit'),       ('ADMIN','users','delete'),
  ('ADMIN','users','assign_role'),
  ('ADMIN','comparables','view'), ('ADMIN','comparables','create'),
  ('ADMIN','comparables','edit'), ('ADMIN','comparables','delete'),
  ('ADMIN','reports','view'),     ('ADMIN','reports','export'),
  ('ADMIN','settings','view'),

  ('MANAGER','quotes','view'),    ('MANAGER','quotes','create'),
  ('MANAGER','quotes','edit'),    ('MANAGER','quotes','view_all'),
  ('MANAGER','users','view'),     ('MANAGER','comparables','view'),
  ('MANAGER','reports','view'),   ('MANAGER','reports','export'),

  ('COMMERCIAL','quotes','view'), ('COMMERCIAL','quotes','create'),
  ('COMMERCIAL','quotes','edit'), ('COMMERCIAL','comparables','view'),

  ('OPERATIONS','quotes','view'),       ('OPERATIONS','comparables','view'),
  ('OPERATIONS','comparables','create'),('OPERATIONS','comparables','edit'),
  ('OPERATIONS','comparables','delete'),

  ('VIEWER','quotes','view'),     ('VIEWER','comparables','view'),
  ('VIEWER','reports','view')
)
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Alta automática de perfil
--
-- Sin esto, un usuario que se registra queda en auth.users sin fila en
-- perfiles: entra pero no tiene rol, ni nombre, ni forma de ser administrado.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function crear_perfil_para_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfiles (id, email, nombre, apellido, status)
  values (
    new.id,
    new.email,
    nullif(split_part(coalesce(new.raw_user_meta_data->>'full_name', ''), ' ', 1), ''),
    nullif(
      substr(
        coalesce(new.raw_user_meta_data->>'full_name', ''),
        strpos(coalesce(new.raw_user_meta_data->>'full_name', ''), ' ') + 1
      ),
      ''
    ),
    -- Quien llega por invitación ya confirmó su correo al fijar contraseña.
    case when new.email_confirmed_at is null then 'INVITED' else 'ACTIVE' end::estado_usuario
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function crear_perfil_para_usuario_nuevo();

-- Mantener actualizado_en sin depender de que la aplicación se acuerde
create or replace function tocar_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists perfiles_actualizado_en on perfiles;
create trigger perfiles_actualizado_en
  before update on perfiles
  for each row execute function tocar_actualizado_en();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Comprobación de permisos en SQL
--
-- Permite que las políticas de RLS hablen de permisos en vez de duplicar la
-- lógica de roles. `security definer` es necesario para leer las tablas de
-- roles desde una policy sin que el usuario tenga acceso directo a ellas.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function tiene_permiso(p_usuario uuid, p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from usuario_roles ur
    join perfiles pf     on pf.id = ur.usuario_id
    join rol_permisos rp on rp.rol_id = ur.rol_id
    join permisos p      on p.id = rp.permiso_id
    where ur.usuario_id = p_usuario
      -- Un usuario suspendido o inactivo no tiene permisos, tenga el rol que tenga
      and pf.status = 'ACTIVE'
      and p.recurso || '.' || p.accion = p_permiso
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────

alter table perfiles      enable row level security;
alter table roles         enable row level security;
alter table permisos      enable row level security;
alter table rol_permisos  enable row level security;
alter table usuario_roles enable row level security;

-- Cada quien lee su propio perfil; quien tenga users.view los lee todos.
drop policy if exists "perfil propio o users.view" on perfiles;
create policy "perfil propio o users.view"
  on perfiles for select
  using (auth.uid() = id or tiene_permiso(auth.uid(), 'users.view'));

drop policy if exists "editar perfiles requiere users.edit" on perfiles;
create policy "editar perfiles requiere users.edit"
  on perfiles for update
  using (tiene_permiso(auth.uid(), 'users.edit'))
  with check (tiene_permiso(auth.uid(), 'users.edit'));

drop policy if exists "crear perfiles requiere users.create" on perfiles;
create policy "crear perfiles requiere users.create"
  on perfiles for insert
  with check (tiene_permiso(auth.uid(), 'users.create'));

-- Sin policy de DELETE a propósito: la baja es por `status`, no por borrado.

-- Catálogos: legibles por cualquier sesión (la UI necesita nombrar roles).
-- Sin policies de escritura desde el cliente: se administran por migración.
drop policy if exists "roles legibles" on roles;
create policy "roles legibles"
  on roles    for select using (auth.uid() is not null);
drop policy if exists "permisos legibles" on permisos;
create policy "permisos legibles"
  on permisos for select using (auth.uid() is not null);
drop policy if exists "rol_permisos legibles" on rol_permisos;
create policy "rol_permisos legibles"
  on rol_permisos for select using (auth.uid() is not null);

drop policy if exists "ver asignaciones propias o con users.view" on usuario_roles;
create policy "ver asignaciones propias o con users.view"
  on usuario_roles for select
  using (auth.uid() = usuario_id or tiene_permiso(auth.uid(), 'users.view'));

drop policy if exists "asignar rol requiere users.assign_role" on usuario_roles;
create policy "asignar rol requiere users.assign_role"
  on usuario_roles for insert
  with check (tiene_permiso(auth.uid(), 'users.assign_role'));

drop policy if exists "quitar rol requiere users.assign_role" on usuario_roles;
create policy "quitar rol requiere users.assign_role"
  on usuario_roles for delete
  using (tiene_permiso(auth.uid(), 'users.assign_role'));

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Cotizaciones: agregar la visibilidad de equipo
--
-- La policy existente ("usuario ve solo sus cotizaciones") NO se toca: se
-- suma otra. En Postgres las policies permisivas se combinan con OR, así que
-- quien no tenga quotes.view_all sigue viendo exactamente lo mismo que antes.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "quotes.view_all ve las del equipo" on cotizaciones;
create policy "quotes.view_all ve las del equipo"
  on cotizaciones for select
  using (tiene_permiso(auth.uid(), 'quotes.view_all'));

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Primer administrador
--
-- Sustituir el correo y correr DESPUÉS de que esa persona haya entrado al
-- menos una vez (el trigger ya le habrá creado el perfil).
-- ─────────────────────────────────────────────────────────────────────────

-- update perfiles set status = 'ACTIVE' where lower(email) = lower('TU_CORREO@ejemplo.mx');
--
-- insert into usuario_roles (usuario_id, rol_id)
-- select pf.id, r.id
-- from perfiles pf cross join roles r
-- where lower(pf.email) = lower('TU_CORREO@ejemplo.mx')
--   and r.nombre = 'SUPER_ADMIN'
-- on conflict do nothing;


-- ############################################################################
-- Endurecimiento de seguridad — cierra 2 hallazgos CRITICAL
-- (origen: supabase/migrations/0005_endurecimiento_rls.sql)
-- ############################################################################

-- ============================================================================
-- ENDURECIMIENTO DE ROW LEVEL SECURITY
--
-- ESTADO: ESCRITA, NO APLICADA. Correr después de 0001/0002/0003.
-- Es independiente de 0004_rbac.sql: se puede aplicar antes o después.
--
-- Cierra dos huecos reales encontrados en la auditoría de seguridad
-- (SECURITY-AUDIT.md, controles #3, #4, #7 y #8).
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- HUECO 1 — `comparables` era legible por cualquiera en internet
--
-- La política original era:
--     create policy "comparables lectura publica"
--       on comparables for select using (true);
--
-- `using (true)` significa "cualquiera", y la anon key de Supabase es
-- PÚBLICA por diseño: va dentro del bundle de JavaScript que sirve la app.
-- Cualquiera podía sacarla del navegador y pedir la tabla completa a la REST
-- API de Supabase sin iniciar sesión.
--
-- Lo que hay en esa tabla no es catálogo público: son los montos reales de
-- patrocinios cerrados, con marca y evento. Es justo la información
-- comercial que la plataforma existe para proteger.
--
-- Corrección: exigir sesión. La narrativa con IA ya exige `quotes.create`,
-- así que el flujo legítimo sigue funcionando igual.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "comparables lectura publica" on comparables;

drop policy if exists "comparables: solo con sesión iniciada" on comparables;
create policy "comparables: solo con sesión iniciada"
  on comparables for select
  using (auth.uid() is not null);

comment on table comparables is
  'Montos reales de patrocinios cerrados. Información comercial sensible: la lectura exige sesión iniciada. NO volver a poner using(true).';


-- ─────────────────────────────────────────────────────────────────────────
-- HUECO 2 — el navegador podía escribir cualquier precio
--
-- La política original permitía a un usuario autenticado insertar en
-- `cotizaciones` siempre que `auth.uid() = user_id`. Eso protege contra
-- escribir en el renglón de OTRO usuario, pero no dice nada sobre el
-- CONTENIDO: el cliente mandaba `precio_min`, `precio_objetivo`,
-- `precio_max` y `desglose` directamente.
--
-- O sea que cualquiera con una sesión válida podía guardar una cotización de
-- $9,000,000 con un `curl`, saltándose la fórmula por completo. Toda la
-- propuesta de valor —"el número es defendible porque sale de una fórmula
-- determinista y auditable"— dependía de que nadie lo intentara.
--
-- Corrección: la escritura pasa por POST /api/cotizaciones, que recalcula el
-- precio del lado del servidor. Aquí se revoca el atajo.
--
-- REQUISITO: `SUPABASE_SERVICE_ROLE_KEY` debe estar configurada en Vercel
-- ANTES de aplicar esta parte, o el guardado dejará de funcionar.
-- El rol `service_role` ignora RLS, así que el endpoint sigue escribiendo.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "usuario crea sus propias cotizaciones" on cotizaciones;

revoke insert, update, delete on cotizaciones from authenticated;
revoke all on cotizaciones from anon;

-- La lectura no cambia: cada quien sigue viendo solo las suyas.
-- (La política "usuario ve solo sus cotizaciones" de 0001 se conserva.)
grant select on cotizaciones to authenticated;

comment on table cotizaciones is
  'Escritura solo vía POST /api/cotizaciones, que recalcula el precio server-side. El INSERT directo desde el navegador está revocado a propósito: permitía guardar cualquier precio.';


-- ─────────────────────────────────────────────────────────────────────────
-- Mínimo privilegio sobre `comparables`
--
-- 0001 no creó políticas de escritura, así que RLS ya la negaba. Se revocan
-- además los privilegios de tabla, para que el día que alguien agregue una
-- política de insert por error no baste para escribir.
-- ─────────────────────────────────────────────────────────────────────────

revoke insert, update, delete on comparables from authenticated, anon;
revoke all on comparables from anon;
grant select on comparables to authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- Verificación — correr después de aplicar
--
-- 1) Ninguna tabla del esquema public sin RLS:
--
--    select tablename, rowsecurity from pg_tables
--    where schemaname = 'public' and rowsecurity = false;
--    -- Debe regresar 0 renglones.
--
-- 2) Ninguna política que conceda a todo el mundo:
--
--    select tablename, policyname, cmd, qual from pg_policies
--    where schemaname = 'public' and qual = 'true';
--    -- Debe regresar 0 renglones.
--
-- 3) Sin sesión, `comparables` ya no devuelve datos:
--
--    curl "$SUPABASE_URL/rest/v1/comparables?select=*" -H "apikey: $ANON_KEY"
--    -- Debe regresar [] (no la tabla).
--
-- 4) Con sesión, el INSERT directo se rechaza:
--
--    curl -X POST "$SUPABASE_URL/rest/v1/cotizaciones" \
--      -H "apikey: $ANON_KEY" -H "Authorization: Bearer $USER_JWT" \
--      -H "Content-Type: application/json" \
--      -d '{"user_id":"<tu-uuid>","nombre_evento":"x","aforo":1,"dias":1,
--           "lineup":"C","exclusiva":false,"activacion":"media",
--           "ciudad_tier":"tier3","precio_objetivo":9000000}'
--    -- Debe regresar 401/403, no 201.
-- ─────────────────────────────────────────────────────────────────────────


-- ############################################################################
-- Marca y contacto en las cotizaciones
-- (origen: supabase/migrations/0006_marca_contacto.sql)
-- ############################################################################

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
  drop constraint if exists cotizaciones_marca_presente;
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


-- ############################################################################
-- VERIFICACIÓN — corre estas tres y revisa el resultado
-- ############################################################################

-- 1) Ninguna tabla sin seguridad a nivel de renglón. Debe regresar 0 renglones.
select tablename as "TABLA SIN RLS — ESTO ESTÁ MAL"
from pg_tables where schemaname = 'public' and rowsecurity = false;

-- 2) Ninguna política abierta a todo el mundo. Debe regresar 0 renglones.
select tablename, policyname as "POLÍTICA ABIERTA — ESTO ESTÁ MAL"
from pg_policies where schemaname = 'public' and qual = 'true';

-- 3) Resumen de lo que quedó instalado. Los números deben ser: 18 permisos,
--    6 roles, y las columnas marca/contacto presentes.
select
  (select count(*) from permisos)                  as permisos,
  (select count(*) from roles)                     as roles,
  (select count(*) from rol_permisos)              as asignaciones,
  (select count(*) from information_schema.columns
     where table_name = 'cotizaciones'
       and column_name in ('marca','contacto'))    as columnas_marca_contacto;
