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
('Ultra Mexico 2026', 'Sprite', 1200000, 45000, 3, 'A', true, 'oficial', 'tier1'),
('Goleiro FanFest', 'Michelob Ultra', 650000, 15000, 5, 'B', true, 'oficial', 'tier1'),
('Match Cup', 'Fronton Bucareli', 300000, 2000, 1, 'C', false, 'proveedor', 'tier1');
