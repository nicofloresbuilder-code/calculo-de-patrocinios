# DECISIONS — Aforo

Bitácora de decisiones de build. Se actualiza al cierre de cada sesión.

---

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

**Deploy 1 — confirmado en producción:** `calculo-de-patrocinios.vercel.app` (usuario conectó el repo vía Vercel dashboard). Probado ahí mismo con los inputs de "Match Cup" (aforo 2,000, 1 día, line-up C, proveedor, tier1): regresa $81,000–$140,400, objetivo $108,000 — muy por **debajo** del ~$300K real. Junto con el hallazgo de Ultra México (Commit 4, muy por **arriba**), esto le da a Commit 7 dos señales opuestas: el clamp de `aforo` (0.3–3.0) castiga demasiado a eventos chicos y la `base` de `oficial` parece sobrestimada para eventos grandes — no es un solo peso mal, son al menos dos ajustes independientes.

**Siguiente paso (mañana / próxima sesión):**
1. Poner `ANTHROPIC_API_KEY` en Vercel (Project Settings → Environment Variables) y redeploy — deploy 2, cierra Commit 5 del todo.
2. Crear el proyecto real de Supabase, correr `supabase/migrations/0001_init.sql`, habilitar Google como provider en Supabase Auth, y pegar `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local` + Vercel — para cerrar Commit 2 de verdad.
3. Con Supabase real: cerrar Commit 6 (guardar + RLS con dos usuarios distintos) y Commit 7 (pase mecánico con los 3 deals reales, corrigiendo el clamp de aforo y la base de `oficial` que ya se ven sobre/subestimados).
