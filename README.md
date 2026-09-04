# Aforo

Plataforma interna de pricing de patrocinios para eventos en vivo en México.
Un ejecutivo comercial mete las variables de un evento (aforo, duración,
calibre del line-up, exclusividad, tipo de activación, ciudad, territorio de
la activación) y la plataforma devuelve un rango de precio defendible —
mínimo, objetivo de cierre y máximo — con el desglose de cuánto pesa cada
variable.

**El precio nunca lo decide el modelo de lenguaje.** Sale de una fórmula
determinista calibrada contra deals reales; el LLM solo explica el racional y
rankea comparables históricos.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) · React 19 |
| Estilos | Tailwind CSS v4 (`@theme inline`, sin `tailwind.config.js`) |
| Base de datos | Supabase (Postgres) con Row Level Security |
| Autenticación | Supabase Auth |
| Autorización | RBAC propio — ver `RBAC-ARCHITECTURE.md` |
| LLM | Anthropic API, solo desde el servidor |
| Hosting | Vercel |
| Paquetes | npm |

## Empezar

```bash
npm install
cp .env.example .env.local   # y llenar los valores
npm run dev                  # http://localhost:3000
```

Sin variables de Supabase la app arranca igual: el cotizador funciona
completo (el cálculo es local), y quedan deshabilitados el guardado, el
listado de cotizaciones y el racional con IA.

## Comandos

```bash
npm run dev      # servidor de desarrollo
npm run build    # build de producción
npm run lint     # ESLint
npm test         # tests de dominio y de autorización (node --test)
npx tsc --noEmit # typecheck
```

## Documentación

| Archivo | Qué contiene |
|---|---|
| `DESIGN-SYSTEM.md` | Tokens, primitivas, reglas de uso, contrastes verificados |
| `PRODUCT-UI-AUDIT.md` | Auditoría de UX/UI/frontend/accesibilidad y prioridades |
| `RBAC-ARCHITECTURE.md` | Modelo de usuarios, roles y permisos; capas de seguridad |
| `SECURITY-AUDIT.md` | Auditoría de seguridad: 20 controles, hallazgos, correcciones y pendientes |
| `DECISIONS.md` | Bitácora de decisiones: por qué cada número de la fórmula es el que es |
| `docs/PACKET.md` | El problema, el usuario y el benchmark |
| `.claude/skills/` | Guías de trabajo para agentes de código en este repo |

## Base de datos

Migraciones en `supabase/migrations/`, se corren en orden en el SQL Editor de
Supabase.

**Escritas y sin aplicar todavía:**
- `0004_rbac.sql` — perfiles, roles y permisos. Ver `RBAC-ARCHITECTURE.md` §6.
- `0005_endurecimiento_rls.sql` — **cierra dos vulnerabilidades CRITICAL**.
  Ver `SECURITY-AUDIT.md` §6-A. Requiere `SUPABASE_SERVICE_ROLE_KEY`
  configurada en Vercel *antes* de aplicarla.

## Estructura

```
src/
├── app/                  rutas (App Router)
├── components/
│   ├── ui/               design system — primitivas
│   ├── shell/            app shell: sidebar, topbar, page header
│   ├── auth/             <Can>, usePermissions()
│   └── *.tsx             componentes del cotizador
├── lib/
│   ├── auth/             catálogo de permisos, can(), DAL de sesión
│   ├── validation/       parseo de entrada no confiable + allowlist de campos
│   ├── rateLimit.ts      presupuestos de rate limiting por endpoint
│   ├── supabase/         clientes de servidor y de navegador
│   ├── navigation.ts     registro de módulos con sus permisos
│   └── pricing.ts        motor de precio determinista (NO TOCAR sin leer DECISIONS.md)
└── proxy.ts              refresco de sesión (en Next 16 el middleware se llama Proxy)
```
