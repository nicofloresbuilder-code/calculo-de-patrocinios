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

create type estado_usuario as enum ('ACTIVE', 'INACTIVE', 'INVITED', 'SUSPENDED');

create table perfiles (
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

create unique index perfiles_email_unico on perfiles (lower(email));
create index perfiles_status_idx on perfiles (status);

comment on table perfiles is
  'Datos propios del usuario. auth.users no acepta columnas nuevas, por eso existe esta tabla espejo.';
comment on column perfiles.status is
  'Baja lógica: nunca se borra un usuario, se pasa a INACTIVE o SUSPENDED. Solo ACTIVE puede operar.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Roles y permisos
-- ─────────────────────────────────────────────────────────────────────────

create table roles (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  -- Un rol de sistema no se puede borrar desde el panel: si alguien elimina
  -- SUPER_ADMIN por accidente, la plataforma se queda sin quien administre.
  es_sistema boolean not null default false,
  creado_en timestamptz not null default now()
);

create table permisos (
  id uuid primary key default gen_random_uuid(),
  recurso text not null,
  accion text not null,
  descripcion text,
  unique (recurso, accion)
);

comment on table permisos is
  'Espejo relacional del catálogo de src/lib/auth/permissions.ts. El código pregunta por "recurso.accion".';

create table rol_permisos (
  rol_id uuid not null references roles(id) on delete cascade,
  permiso_id uuid not null references permisos(id) on delete cascade,
  primary key (rol_id, permiso_id)
);

create table usuario_roles (
  usuario_id uuid not null references perfiles(id) on delete cascade,
  rol_id uuid not null references roles(id) on delete restrict,
  asignado_por uuid references auth.users(id) on delete set null,
  asignado_en timestamptz not null default now(),
  primary key (usuario_id, rol_id)
);

create index usuario_roles_usuario_idx on usuario_roles (usuario_id);

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
  ('settings', 'edit',       'Editar configuración');

insert into roles (nombre, descripcion, es_sistema) values
  ('SUPER_ADMIN', 'Control total de la plataforma, incluida la configuración.', true),
  ('ADMIN',       'Administra usuarios y catálogos. No cambia la configuración global.', true),
  ('MANAGER',     'Ve las cotizaciones de todo el equipo y exporta reportes.', false),
  ('COMMERCIAL',  'Crea y edita sus propias cotizaciones.', false),
  ('OPERATIONS',  'Mantiene el catálogo de comparables.', false),
  ('VIEWER',      'Solo consulta.', false);

-- SUPER_ADMIN: todo el catálogo
insert into rol_permisos (rol_id, permiso_id)
select r.id, p.id from roles r cross join permisos p where r.nombre = 'SUPER_ADMIN';

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
);

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
create policy "perfil propio o users.view"
  on perfiles for select
  using (auth.uid() = id or tiene_permiso(auth.uid(), 'users.view'));

create policy "editar perfiles requiere users.edit"
  on perfiles for update
  using (tiene_permiso(auth.uid(), 'users.edit'))
  with check (tiene_permiso(auth.uid(), 'users.edit'));

create policy "crear perfiles requiere users.create"
  on perfiles for insert
  with check (tiene_permiso(auth.uid(), 'users.create'));

-- Sin policy de DELETE a propósito: la baja es por `status`, no por borrado.

-- Catálogos: legibles por cualquier sesión (la UI necesita nombrar roles).
-- Sin policies de escritura desde el cliente: se administran por migración.
create policy "roles legibles"    on roles    for select using (auth.uid() is not null);
create policy "permisos legibles" on permisos for select using (auth.uid() is not null);
create policy "rol_permisos legibles"
  on rol_permisos for select using (auth.uid() is not null);

create policy "ver asignaciones propias o con users.view"
  on usuario_roles for select
  using (auth.uid() = usuario_id or tiene_permiso(auth.uid(), 'users.view'));

create policy "asignar rol requiere users.assign_role"
  on usuario_roles for insert
  with check (tiene_permiso(auth.uid(), 'users.assign_role'));

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
