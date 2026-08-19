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

**Siguiente paso (mañana / próxima sesión):**
- Deploy 1 a Vercel (falta que el usuario conecte su cuenta de Vercel/GitHub — ver mensaje de chat).
- Commit 2: crear proyecto de Supabase, correr la migración de `BUILD_PROMPT.md`, wire de Google OAuth — falta que el usuario cree el proyecto y comparta URL/anon key (la service role key nunca se pega en chat, solo va directo a env vars de Vercel).
