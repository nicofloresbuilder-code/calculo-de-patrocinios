# DECISIONS — Aforo

Bitácora de decisiones de build. Se actualiza al cierre de cada sesión.

---

*(`ANTHROPIC_API_KEY` agregada en Vercel — este commit solo dispara el redeploy para que la tome.)*

## Sesión 1 — 2026-08-19

**Qué se decidió:**
- Scaffold con `create-next-app` (Next.js 16, App Router, TypeScript, Tailwind v4, `src/` dir, alias `@/*`).
- Paleta y layout de dos columnas replicando `docs/assets/aforo_mockup.png`: header con "AFORO" + subtítulo, sidebar de variables a la izquierda, panel de rango + desglose + racional a la derecha. Sin lógica todavía (placeholders estáticos) — eso es Commit 3/4.
- `docs/PACKET.md` y `docs/assets/aforo_mockup.png` copiados al repo (el packet existía antes del código, como pide el criterio de aceptación).
- `.env.example` creado con las 4 variables que van a necesitarse (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`) — ninguna llave real en el repo.

**Por qué:**
- Layout primero, sin lógica, para poder desplegar temprano (Commit 1 pide deploy 1) y validar que el pipeline Vercel funciona antes de meter Supabase/Auth/LLM.

**Problemas encontrados y cómo se resolvieron:**
- La caché global de npm (`~/.npm/_cacache`) tenía entradas escritas por `root` en una instalación anterior → `EACCES`/`EEXIST` al instalar. Se resolvió apuntando `npm install` a una caché local del proyecto (`.npm-cache/`, ya en `.gitignore`) en vez de tocar permisos del sistema.
- La red estuvo intermitente durante la descarga inicial de paquetes: algunos tarballs (`@swc/helpers`, `@typescript-eslint/eslint-plugin`) quedaron truncados (`TAR_ENTRY_ERROR`), lo que rompía `next build` con `Module not found`. Se resolvió borrando esos paquetes puntuales y reinstalando.

**Commit 3 — Formulario:** los 7 campos del sidebar son exactamente las 7 llaves de `cotizaciones` (`nombre_evento`, `aforo`, `dias`, `lineup`, `exclusiva`, `activacion`, `ciudad_tier`) — no el campo decorativo "Tipo de evento" del mockup, que no existe en el schema ni en `computePrice()`. Validación pura en `src/lib/validateEvento.ts` (Security Floor #4: aforo/días enteros positivos con tope, resto son selects fijos). Verificado en browser: aforo=0 y días=999 bloquean el submit con mensaje de error; datos válidos loguean el objeto con las 7 llaves.

**Commit 4 — Motor de pricing:** `computePrice()` implementado tal cual el código de `BUILD_PROMPT.md`, sin tocar los pesos. Tests con el runner nativo de Node (`node --experimental-strip-types --test`) en vez de instalar Vitest/Jest — evita más descargas npm con la red que ya dio problemas, y corre el comparable real "Match Cup". 4/4 pasan.
- **Discrepancia mockup vs. fórmula:** el mockup (`docs/assets/aforo_mockup.png`) ilustra 6 barras de desglose (incluye "Activación" al 10%). La fórmula dada solo tiene 5 factores multiplicativos (`aforo`, `duracion`, `lineup`, `exclusividad`, `ciudad`) — `activacion` fija la `base` en pesos, no es un factor porcentual, así que no le corresponde una barra de desglose real sin inventar un número. Decisión: mostrar las 5 barras reales de `desglose`, no fabricar una sexta. Si se quiere una barra de "activación" de verdad, hay que rediseñar la fórmula para que sea un factor sobre una base común, no la base en sí — eso es una decisión de producto para el pase mecánico (Commit 7), no algo para inventar ahora.
- Con los inputs del mockup (Ultra México: aforo 45,000, 3 días, line-up A, exclusiva, oficial, tier1) la fórmula tal cual regresa objetivo ≈ $4.9M, muy por arriba del ≈$1.2M que de verdad se negoció y de los $850K–$1.4M ilustrados en el mockup. Es exactamente la señal que Commit 7 (pase mecánico) tiene que corregir — pesos/base de `oficial` vienen sobrestimados. Se deja así a propósito: implementar la fórmula dada sin alterarla, y dejar que el pase mecánico con datos reales sea el que la corrija con evidencia, no una corazonada a medio build.

**Commit 2 (prep) — Supabase + Auth:** todo el wiring de `@supabase/ssr` (clientes browser/server, `src/proxy.ts` para refrescar sesión, callback de OAuth, botón de Google en el header) está escrito y buildea limpio sin proyecto real conectado (guards en `if (!process.env.NEXT_PUBLIC_SUPABASE_URL)`). No se puede marcar como cerrado de verdad hasta tener un proyecto de Supabase real: falta correr `supabase/migrations/0001_init.sql`, habilitar el provider de Google en Supabase Auth, y verificar con una query anónima que RLS bloquea `cotizaciones`.
- Nota Next.js 16: `middleware.ts` está deprecado a favor de `proxy.ts` (mismo patrón, export se llama `proxy` en vez de `middleware`) — usado desde el día 1 para no acumular deuda con un codemod después.

**Commit 5 — Narrativa LLM (cerrado en local):** API route server-side (`src/app/api/narrativa/route.ts`) con el system prompt exacto de `BUILD_PROMPT.md`. Sin `ANTHROPIC_API_KEY` responde 501 con mensaje claro sin romper el resto del flujo (verificado). Con la key real (guardada solo en `.env.local`, nunca en el repo — `git grep sk-ant` sobre archivos trackeados sale limpio) la narrativa sale en español, tono directo, 2-3 líneas, sin inventar cifras que no se le dieron y sin comparables porque Supabase aún no está conectado (comportamiento esperado, no un bug). Primer intento falló con 400 "credit balance too low" — no era bug de código, era que la cuenta de Anthropic no tenía crédito cargado; se resolvió cargando crédito en console.anthropic.com/settings/billing. Pendiente: agregar la misma env var en Vercel (Project Settings → Environment Variables) y redeploy para que funcione también en producción — eso es el "deploy 2".

**Bloqueo de sesión — autenticación de GitHub (resuelto):** esta máquina no tenía credenciales de GitHub (ni token en keychain ni llave SSH), así que no se pudo hacer `git push` directo. Se instaló `gh` CLI (Homebrew) y se usó `gh auth login --web` (device flow: el usuario aprobó un código de un solo uso en github.com/login/device desde su navegador, sin que el agente viera contraseña ni token). El repo remoto ya tenía un commit ("Add files via upload" con `BUILD_PROMPT.md`/`PACKET.md`/`aforo_mockup.png` subidos por la web de GitHub) — se hizo `git merge --allow-unrelated-histories` (sin conflictos, rutas distintas a `docs/`) antes de pushear.

**Commit 6 (prep) — Guardar cotización:** `GuardarCotizacion.tsx` inserta con `user_id` explícito (RLS exige `auth.uid() = user_id`); `/cotizaciones` lista las propias vía RLS (sin `.eq` manual). Verificado sin Supabase conectado: el flujo de cálculo sigue intacto y muestra "inicia sesión para guardar" en vez de romperse.

**Deploy 1 — confirmado en producción:** `calculo-de-patrocinios.vercel.app` (usuario conectó el repo vía Vercel dashboard). Probado ahí mismo con los inputs de "Match Cup" (aforo 2,000, 1 día, line-up C, proveedor, tier1): regresa $81,000–$140,400, objetivo $108,000 — muy por debajo de lo negociado. *(Nota: en esta prueba se comparó contra el monto placeholder del seed SQL, $300K — el número real confirmado por el usuario en Commit 7 también es $300K, así que la lectura no cambia; pero el placeholder de Ultra México ($1.2M) sí resultó incorrecto, ver Commit 7 abajo con la cifra real de $5M.)*

**Bloqueo de sesión — Vercel "Blocked" deployments:** después de agregar `ANTHROPIC_API_KEY`, varios redeploys (por push y por dashboard) quedaron en estado "Blocked" indefinidamente — no era un error de build, la cuenta tiene dos proyectos duplicados (`calculo-de-patrocinios` y `calculo-de-patrocinios-braz`, restos de un import anterior bajo team) y el deploy vivo en el dominio corto llevaba 2h sin la key nueva. Se instaló Vercel CLI (`npx vercel`, cache local por el mismo motivo de permisos rotos de npm) y se hizo login por device flow (igual que GitHub: el usuario aprueba en su navegador, el agente no ve credenciales). Con el CLI se encontró una env var mal escrita (`anhtropic_api_key`, de un intento manual previo) — se borró — y se linkeó el proyecto correcto. El deploy vía `vercel --prod` también se quedó en "Building…"/status UNKNOWN varios minutos: esto ya parece una restricción a nivel cuenta de Vercel (posible verificación de pago pendiente en cuenta nueva), no algo resoluble desde el código — pendiente que el usuario revise Account Settings → Billing. El deploy anterior (sin key) sigue sirviendo la URL, así que "Deploy 1: vive en una URL real" no se pierde por esto.

**Supabase real conectado:** proyecto creado (`ietahcthuejmgjlmgsub.supabase.co`), migración `0001_init.sql` corrida por el usuario en el SQL Editor. Verificado con curl contra la REST API (no solo "debería funcionar"):
- `GET /rest/v1/comparables` sin auth → regresa los 3 seeds (lectura pública OK).
- `GET /rest/v1/cotizaciones` sin auth → `[]` (RLS bloquea, no error feo, tal como se diseñó).
- `POST /rest/v1/cotizaciones` sin auth → HTTP 401, `"new row violates row-level security policy"` (RLS también bloquea insert anónimo). Este es exactamente el piso de seguridad #2/#3 del BUILD_PROMPT, verificado con evidencia real, no solo con el guard de código.

**Bug real encontrado y arreglado — Commit 5:** con comparables ya en la base, la narrativa empezó a fallar con `SyntaxError: Unexpected token '\`'`. Causa: Claude envuelve el JSON de respuesta en un code fence markdown (```json ... ```) a pesar de que el system prompt dice "SOLO en JSON, sin texto fuera del JSON" — el modelo no lo respeta al 100%. Se agregó `extractJson()` en `src/app/api/narrativa/route.ts` que le quita el fence si existe y recorta al primer `{...}` balanceado antes de parsear. Verificado: la narrativa ahora sale con comparables reales, y de hecho el modelo señaló solo (sin que se le pidiera) que el comparable "Ultra México 2026 · Sprite" pagó mucho menos que el rango calculado — la misma discrepancia que ya se había detectado en Commit 4/deploy 1, ahora confirmada desde un ángulo distinto (LLM comparando contra el comparable real, no solo la fórmula contra el número negociado).

## Commit 7 — Pase mecánico

**Cifras reales confirmadas por el usuario** (los montos del seed SQL eran placeholder, como advertía su propio comentario):

| Deal | Placeholder (seed) | Real confirmado |
|---|---|---|
| Ultra México · Sprite | $1,200,000 | **$5,000,000** |
| Goleiro FanFest · Michelob Ultra | $650,000 | **$1,000,000** |
| Match Cup · Frontón Bucareli | $300,000 | $300,000 (sin cambio) |

**Qué falló:** corriendo `computePrice()` tal cual (Commit 4) contra las 3 cifras reales:

| Deal | Real | Computado (antes) | Desvío |
|---|---|---|---|
| Ultra México | $5,000,000 | $4,914,000 | -1.7% ✅ |
| Goleiro | $1,000,000 | $1,656,000 | **+65.6%** ❌ |
| Match Cup | $300,000 | $108,000 | **-64.0%** ❌ |

Ultra México ya cuadraba casi perfecto. Los otros dos fallaban en direcciones opuestas. Se investigó cada uno por separado en vez de forzar un solo ajuste que "promediara" los dos errores:

- **Match Cup (aforo=2,000):** el factor de aforo es `clamp(aforo/20000, 0.3, 3.0)`. En 2,000 personas eso da `0.1`, clampeado al piso `0.3` — el mismo piso que le tocaría a un evento de 500 o de 5,999 personas, sin distinguir entre ellos. Ese piso demasiado bajo es la causa directa del -64%.
- **Goleiro (aforo=15,000):** no cae en el clamp (15000/20000=0.75, dentro de rango) — el desvío ahí no viene del piso de aforo, viene de otro lado (posiblemente `duracion` sobre-pesado para eventos de 5 días, o que "oficial" no capture bien un activation de 5 días con múltiples días de exposición). No se tocó en este pase para no adivinar un segundo cambio sin evidencia aislada de cuál variable es la culpable.

**Qué se corrigió:** el piso del factor de aforo, de `0.3` a `0.7`, en `src/lib/pricing.ts` (`AFORO_FACTOR_MIN`). Solo afecta eventos con aforo/20000 < 0.7 (es decir, aforo < 14,000) — no toca Ultra ni Goleiro, que ya estaban fuera del clamp.

**Resultado nuevo vs. real:**

| Deal | Real | Computado (después) | Desvío |
|---|---|---|---|
| Ultra México | $5,000,000 | $4,914,000 | -1.7% (sin cambio, no afectado) |
| Goleiro | $1,000,000 | $1,656,000 | +65.6% (sin cambio — pendiente, ver arriba) |
| Match Cup | $300,000 | $252,000 | **-16.0%** (antes -64.0%) |

Match Cup mejoró de 64% de error a 16% — no perfecto, pero un fix real y aislado, no una corazonada. Tests nuevos en `src/lib/pricing.test.ts` (7/7 pasan) fijan estos 3 números como regresión, incluyendo uno que documenta explícitamente que Goleiro sigue sobrestimado (para que no se "arregle solo" silenciosamente si alguien más toca la fórmula sin revisar esto).

**Por qué no se tocó Goleiro en el mismo pase:** un solo comparable con sobrestimación (65.6%) no da suficiente señal para saber si el problema está en `duracion`, en la `base` de `oficial`, o en otra interacción — cualquier ajuste ahora sería una corazonada, exactamente lo que este proceso está tratando de evitar. Queda documentado como pendiente para el próximo deal real que se cierre.

**Redeploy:** commiteado y pusheado a `main`; el redeploy a producción está bloqueado por el mismo problema de cuenta de Vercel de la sección anterior (no por este cambio) — se aplicará solo cuando eso se resuelva.

## Siguiente paso (mañana / próxima sesión)

1. Resolver el bloqueo de Vercel (revisar billing/verificación de cuenta) y redeploy — deploy 2, cierra Commit 5 y Commit 7 del todo en producción.
2. Habilitar Google como provider en Supabase Auth (Authentication → Providers → Google, necesita un OAuth Client ID/Secret de Google Cloud Console) — para poder probar el login real y cerrar Commit 2/6 de punta a punta (guardar cotización + verificar que otro user_id no ve la de este usuario).
3. Con un deal real más (idealmente otro chico o mediano con `oficial`), investigar el sobrepeso de Goleiro: aislar si es `duracion`, la `base` de `oficial`, o ambos, antes de tocar la fórmula otra vez.
