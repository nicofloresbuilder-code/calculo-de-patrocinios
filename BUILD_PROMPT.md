# BUILD PROMPT — Aforo
Pega esto completo a tu coding agent (Claude Code / Cursor / lo que uses). Referencia: `docs/PACKET.md` en este mismo repo tiene el problema, el mockup y los diagramas — ábrelo primero.

---

## Contexto para el agente

Vas a construir **Aforo**, un cotizador de patrocinios para eventos en vivo en México. Un ejecutivo comercial mete las variables de un evento (aforo, duración, line-up, exclusividad, tipo de activación, ciudad) y la app regresa un rango de precio sugerido (mín–objetivo–máx) con un desglose de qué variable pesa cuánto, más una narrativa generada por IA que explica el racional. El precio **nunca lo decide el LLM** — sale de una fórmula determinista; el LLM solo explica y rankea comparables. Lee `docs/PACKET.md` para el problema completo, el mockup visual y los dos diagramas Mermaid del flujo antes de escribir código.

## Stack fijo (no lo cambies)

- **Frontend:** Next.js (App Router) + Tailwind, deploy en Vercel
- **Base de datos + Auth:** Supabase (Postgres + Supabase Auth, "Sign in with Google")
- **LLM:** Anthropic API (Claude), llamada solo desde el servidor (API route), nunca desde el cliente
- **Hosting:** Vercel, free tier

## Modelo de datos (Supabase — corre esto como migración inicial)

```sql
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

-- seed: PLACEHOLDER — reemplazar monto_mxn con las cifras reales antes del pase mecanico
insert into comparables (nombre, marca, monto_mxn, aforo, dias, lineup, exclusiva, activacion, ciudad_tier) values
('Ultra Mexico 2026', 'Sprite', 1200000, 45000, 3, 'A', true, 'oficial', 'tier1'),
('Goleiro FanFest', 'Michelob Ultra', 650000, 15000, 5, 'B', true, 'oficial', 'tier1'),
('Match Cup', 'Fronton Bucareli', 300000, 2000, 1, 'C', false, 'proveedor', 'tier1');
```

## La fórmula de pricing (implementar como función pura, testeable sin UI)

```javascript
const BASE_ACTIVACION = { naming: 2_000_000, oficial: 800_000, proveedor: 300_000, media: 150_000 };
const LINEUP_FACTOR = { A: 1.4, B: 1.15, C: 1.0 };
const CIUDAD_FACTOR = { tier1: 1.2, tier2: 1.0, tier3: 0.85 };

function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

function computePrice({ activacion, aforo, dias, lineup, exclusiva, ciudad_tier }) {
  const base = BASE_ACTIVACION[activacion];

  const factors = {
    aforo: clamp(aforo / 20000, 0.3, 3.0),
    duracion: 1 + (dias - 1) * 0.15,
    lineup: LINEUP_FACTOR[lineup],
    exclusividad: exclusiva ? 1.25 : 1.0,
    ciudad: CIUDAD_FACTOR[ciudad_tier],
  };

  const totalFactor = Object.values(factors).reduce((a, b) => a * b, 1);
  const objetivo = base * totalFactor;
  const min = objetivo * 0.75;
  const max = objetivo * 1.3;

  // desglose: % de cuánto empuja cada variable, normalizado a 100
  const devs = Object.entries(factors).map(([k, v]) => [k, Math.abs(Math.log(v))]);
  const totalDev = devs.reduce((s, [, d]) => s + d, 0) || 1;
  const desglose = Object.fromEntries(devs.map(([k, d]) => [k, Math.round((d / totalDev) * 100)]));

  return { min, objetivo, max, factors, desglose, base };
}
```

**Estos pesos (1.4 / 1.25 / 1.2 / etc.) son un punto de partida inventado, no datos verificados.** El Feature 5 de abajo (pase mecánico) es exactamente el paso donde se recalibran contra tus 3 deals reales — no los trates como definitivos antes de eso.

## El prompt del LLM (system prompt para la API route que genera la narrativa)

```
Eres un analista de pricing de patrocinios para eventos en vivo en México.
Recibes las variables de un evento, el precio calculado (min/objetivo/max),
y hasta 3 comparables históricos.

Responde SOLO en JSON, sin texto fuera del JSON:
{
  "narrativa": "2-3 líneas explicando qué variables empujan el precio hacia
                arriba o abajo, en español, tono directo, sin relleno",
  "comparables_relevantes_ids": ["id1", "id2"]
}

No inventes cifras que no te dieron. No cambies el precio — solo explícalo.
```

## Piso de seguridad — mapeado a este proyecto

1. **Sin secretos en el repo:** `ANTHROPIC_API_KEY` y `SUPABASE_SERVICE_ROLE_KEY` solo en variables de entorno de Vercel. Antes de cada commit, `grep -r "sk-ant\|service_role" .` no debe regresar nada.
2. **Auth:** Supabase Auth con Google. Nadie guarda una cotización sin sesión.
3. **RLS ON** en `cotizaciones` (ya está en el SQL de arriba) — verificar con una query como usuario anónimo que debe fallar.
4. **Validación de inputs:** aforo y días son enteros positivos con tope razonable (aforo max 500,000, días max 30); el resto son selects de opciones fijas, no texto libre.
5. **Sin datos reales de terceros:** los 3 comparables son deals que tú mismo negociaste (no hay datos personales de otras personas); si agregas más comparables de otras agencias, anonimiza o etiqueta como estimado.

## Commits — chico, testeable, en este orden

**Commit 1 — Scaffold + deploy 1**
Next.js vacío con el header "Aforo" y el layout de dos columnas del mockup (sin lógica). Deploy a Vercel.
✅ *Acceptance:* la URL vive y muestra el layout base.

**Commit 2 — Supabase + Auth**
Conectar Supabase, correr la migración de arriba, wire de "Sign in with Google".
✅ *Acceptance:* puedo iniciar sesión; una query anónima a `cotizaciones` regresa vacío/error (RLS funcionando).

**Commit 3 — Formulario de variables**
Los 7 campos del sidebar del mockup, con validación (Security Floor #4). Al enviar, solo hace `console.log` del objeto — todavía sin fórmula.
✅ *Acceptance:* el form no deja mandar aforo negativo ni días > 30; el objeto logueado tiene las 7 llaves correctas.

**Commit 4 — Motor de pricing**
Implementar `computePrice()` como función pura + un test unitario simple corriendo el objeto del comparable "Match Cup" y verificando que regresa un rango. Wire a la UI: barra de rango + barras de desglose como en el mockup.
✅ *Acceptance:* el test unitario pasa; la UI muestra el rango y las 6 barras del desglose sumando ~100%.

**Commit 5 — Narrativa con LLM + deploy 2**
API route server-side que llama a Claude con el prompt de arriba, usando el precio ya calculado + los comparables desde Supabase. Render en el panel "Por qué este rango". Redeploy con las env vars de producción.
✅ *Acceptance:* la narrativa aparece en español, sin cifras inventadas; `grep` confirma que no hay API key en el código.

**Commit 6 — Guardar cotización**
Usuario autenticado guarda su cotización (insert a `cotizaciones` con su `user_id`); lista simple de cotizaciones guardadas.
✅ *Acceptance:* creo una cotización, la veo en la lista; confirmo por query directa que otro `user_id` no puede leerla (RLS).

**Commit 7 — Pase mecánico (bug + fix + redeploy)**
Corro los 3 comparables reales (con tus cifras verificadas, no las placeholder) contra la fórmula, comparo contra lo que de verdad negociaste, encuentro al menos un desajuste de peso, lo corrijo en `computePrice()`, redeploy.
✅ *Acceptance:* documentado en `DECISIONS.md` — qué falló, qué pesos cambiaste, y el nuevo resultado vs. el real.

## Cierre de cada sesión (obligatorio, cada vez)

Actualizar `DECISIONS.md` (qué se decidió y por qué), anotar el primer siguiente paso de mañana, `git commit`, `git push`.

## Criterio de aceptación general (lo que se califica)

- Vive en una URL real (Vercel) — 4 pts
- El packet existía antes del código — 2 pts
- Piso de seguridad + zona prohibida (nada de credit score) respetados — 2 pts
- Ciclo probar → encontrar bug → arreglar → redeploy documentado (Commit 7) — 1 pt
- Profundidad del transcript de build — 1 pt
