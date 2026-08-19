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

**Commit 5 (prep) — Narrativa LLM:** API route server-side lista (`src/app/api/narrativa/route.ts`) con el system prompt exacto de `BUILD_PROMPT.md`. Verificado en browser que sin `ANTHROPIC_API_KEY` responde 501 con mensaje claro y no rompe el resto del flujo (rango/desglose siguen funcionando). Falta la key real para verificar que la narrativa sale en español sin cifras inventadas.

**Bloqueo de sesión — autenticación de GitHub:** esta máquina no tenía credenciales de GitHub (ni token en keychain ni llave SSH), así que no se pudo hacer `git push` directo. Se instaló `gh` CLI (Homebrew) y se arrancó `gh auth login --web` (device flow: el usuario aprueba un código de un solo uso en github.com/login/device desde su navegador, sin que el agente vea contraseña ni token) — quedó pendiente de aprobación al cierre de la sesión.

**Siguiente paso (mañana / próxima sesión):**
1. Terminar `gh auth login` (o correr `git push -u origin main` manualmente) para subir los 6 commits locales a `nicofloresbuilder-code/calculo-de-patrocinios`.
2. Deploy 1 a Vercel: importar el repo desde vercel.com una vez que el push llegue.
3. Crear el proyecto real de Supabase, correr `supabase/migrations/0001_init.sql`, habilitar Google como provider en Supabase Auth, y pegar `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local` + Vercel — para cerrar Commit 2 de verdad.
4. Conseguir `ANTHROPIC_API_KEY` y ponerla en `.env.local` + Vercel — para cerrar Commit 5 de verdad y hacer el deploy 2.
