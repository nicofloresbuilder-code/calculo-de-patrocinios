-- ============================================================
-- AFORO — setup completo para un proyecto de Supabase NUEVO
--
-- Usa este archivo SOLO si hay que crear un proyecto desde cero.
-- Si el proyecto viejo solo estaba pausado y se reactivó, NO corras
-- esto: ya tiene 0001 aplicada, y solo faltarían 0002 y 0003.
--
-- Union de 0001 + 0002 + 0003, con los montos de comparables ya
-- corregidos a las cifras reales (el seed original traía
-- placeholders: Ultra $1.2M cuando cerro en $5M).
-- ============================================================

-- Migración inicial de Aforo.
-- Correr en Supabase SQL Editor (o `supabase db push` si usas el CLI).
-- Fuente: BUILD_PROMPT.md — no modificar los pesos/estructura sin actualizar
-- también src/lib/pricing.ts y DECISIONS.md.

create extension if not exists "pgcrypto";

create table comparables (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  marca text not null,
  monto_mxn numeric not null,
  aforo integer not null,
  dias integer not null,
  lineup text not null check (lineup in ('A','B','C')),
  exclusiva boolean not null,
  activacion text not null check (activacion in ('naming','oficial','proveedor','media')),
  ciudad_tier text not null check (ciudad_tier in ('tier1','tier2','tier3')),
  creado_en timestamptz default now()
);

create table cotizaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  nombre_evento text not null,
  aforo integer not null,
  dias integer not null,
  lineup text not null check (lineup in ('A','B','C')),
  exclusiva boolean not null,
  activacion text not null check (activacion in ('naming','oficial','proveedor','media')),
  ciudad_tier text not null check (ciudad_tier in ('tier1','tier2','tier3')),
  precio_min numeric,
  precio_objetivo numeric,
  precio_max numeric,
  desglose jsonb,
  racional text,
  creado_en timestamptz default now()
);

alter table comparables enable row level security;
create policy "comparables lectura publica"
  on comparables for select using (true);
-- sin policy de insert/update/delete desde el cliente: solo se cargan por migración/admin

alter table cotizaciones enable row level security;
create policy "usuario ve solo sus cotizaciones"
  on cotizaciones for select using (auth.uid() = user_id);
create policy "usuario crea sus propias cotizaciones"
  on cotizaciones for insert with check (auth.uid() = user_id);

-- seed: PLACEHOLDER — reemplazar monto_mxn con las cifras reales antes del pase mecanico (Commit 7)
insert into comparables (nombre, marca, monto_mxn, aforo, dias, lineup, exclusiva, activacion, ciudad_tier) values
('Ultra Mexico 2026', 'Sprite', 5000000, 45000, 3, 'A', true, 'oficial', 'tier1'),
('Goleiro FanFest', 'Michelob Ultra', 1000000, 15000, 5, 'B', true, 'oficial', 'tier1'),
('Match Cup', 'Fronton Bucareli', 300000, 2000, 1, 'C', false, 'proveedor', 'tier1');

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

comment on column cotizaciones.territorio_lado is
  'Lado en metros del espacio de activación (5 = 5x5 m). Anterior a esta columna, la fórmula asumía 5x5.';
comment on column cotizaciones.monto_producto is
  'Parte del deal pagada en producto, a valor declarado por la marca (no lo que se estima vender).';
