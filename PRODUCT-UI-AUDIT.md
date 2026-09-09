# PRODUCT-UI-AUDIT — Aforo

Auditoría de producto, UX, UI, frontend y accesibilidad del estado actual, previa a
la evolución hacia plataforma interna con usuarios y permisos.

**Fecha:** 2026-09-04
**Commit auditado:** `7f30238`
**Método:** lectura completa de `src/`, `supabase/`, `DECISIONS.md`; build de producción;
app corriendo en `next dev`; capturas reales en 1440×900 y 390×844; cálculo de ratios de
contraste WCAG sobre la paleta real; `npm run lint`, `tsc --noEmit`, `npm test`.

---

## 1. Estado actual

### 1.1 Stack detectado (no asumido)

| Capa | Qué hay | Evidencia |
|---|---|---|
| Framework | **Next.js 16.3.1**, App Router, Turbopack | `package.json`, salida de `next build` |
| UI | **React 19.2.8** | `package.json` |
| Estilos | **Tailwind CSS v4** (CSS-first, `@theme inline`), sin `tailwind.config` | `postcss.config.mjs`, `src/app/globals.css` |
| Librería de componentes | **Ninguna** — todo hecho a mano | `src/components/` |
| Iconos | **Ninguno** — no hay librería ni SVGs propios | — |
| Backend | Route Handlers de Next (`/api/narrativa`) | `src/app/api/narrativa/route.ts` |
| Base de datos | **Supabase (Postgres)**, 2 tablas: `comparables`, `cotizaciones` | `supabase/migrations/` |
| Auth | **Supabase Auth**, único proveedor: Google OAuth | `src/lib/supabase/`, `AuthStatus.tsx` |
| Sesión | Cookies vía `@supabase/ssr`, refresco en `src/proxy.ts` | `src/proxy.ts` |
| Autorización | **Solo RLS de Postgres.** No hay roles ni permisos | `0001_init.sql` |
| LLM | Anthropic SDK, server-side | `route.ts` |
| Package manager | **npm** (`package-lock.json`) | — |
| Tests | `node --test` + `--experimental-strip-types`, solo `src/lib/*.test.ts` | `package.json` |
| Deployment | Vercel | `DECISIONS.md` |
| TypeScript | `strict: true`, sin `any` en el código actual | `tsconfig.json` |

**Nota de versión:** Next 16 renombró Middleware a **Proxy**; por eso el archivo es
`src/proxy.ts` y no `middleware.ts`. Cualquier cambio a esa capa debe respetar la
convención nueva.

### 1.2 Salud de la base de código

- `npm run lint` → limpio.
- `npx tsc --noEmit` → limpio (el `LayoutProps` "faltante" solo aparece si no se
  generaron los tipos de `.next/`; tras `next build` desaparece).
- `npm test` → **28/28 pasando**. La lógica de dominio (`pricing`, `producto`,
  `territorio`) está bien cubierta y bien documentada.
- `next build` → verde, 8 rutas.

**El motor de negocio es la parte fuerte del proyecto.** `src/lib/pricing.ts` está
calibrado contra deals reales, con la procedencia de cada número comentada en el
código y en `DECISIONS.md`. Esta auditoría **no propone tocar nada de eso.**

### 1.3 Superficie de producto hoy

Tres pantallas: `/` (cotizador), `/cotizaciones` (lista), `/auth/error`.
Un solo usuario conceptual, un solo rol implícito, sin navegación real.

---

## 2. UX — problemas encontrados

### 2.1 Navegación

- **No existe estructura de navegación.** Hay un header con el logo y un solo link
  ("Mis cotizaciones") que además solo aparece si hay sesión. No hay sidebar, no hay
  jerarquía de módulos, no hay lugar donde crezca "Clientes", "Reportes" o
  "Administración". Cada módulo nuevo hoy no tiene dónde colgarse.
- **No hay breadcrumb ni título de página.** El usuario no sabe dónde está. En
  `/cotizaciones` el único ancla de ubicación es el título del panel.
- **El regreso es un `←` de texto** (`/cotizaciones` línea 66), no un patrón.
- **El menú de usuario no existe.** El email es texto plano y "Cerrar sesión" es un
  link suelto — no hay dónde poner perfil, configuración ni nada futuro.

### 2.2 Jerarquía visual y densidad

- **Todo es un panel.** La pantalla completa son cajas `rounded-lg border bg-panel p-6`
  del mismo peso visual. El resultado: nada destaca. El rango de precio —que es LA
  respuesta que el usuario vino a buscar— vive en un panel idéntico al de "Supuestos".
- **La columna derecha queda vacía en el estado inicial** (ver captura desktop): tres
  cajas con texto explicativo ocupan 2/3 de la pantalla sin aportar nada. Es el estado
  que ve el usuario el 100% de las veces al entrar.
- **Densidad baja para una herramienta interna.** `p-6` en cada panel + `gap-6` entre
  ellos desperdicia espacio vertical en una app donde el usuario compara números.

### 2.3 Claridad de acciones

- **No se distingue acción primaria de secundaria.** "Calcular rango sugerido" es
  ámbar sólido (bien), pero "Guardar cotización" —la segunda acción más importante—
  usa exactamente el mismo estilo que "Iniciar sesión con Google": borde gris, fondo
  input, texto `text-xs`. Y `text-xs` (12px) para un botón de acción real es
  demasiado chico.
- **"Guardar cotización" está escondido** debajo de la barra de rango, sin separación
  visual, y aparece/desaparece según el estado de sesión sin transición.

### 2.4 Flujos

- **El formulario no tiene envío progresivo.** El usuario llena 9 campos y hasta el
  final, al presionar el botón, sabe si hay errores. Los errores solo se muestran
  después del primer submit (`touched`), lo cual es correcto, pero el botón está al
  fondo de un formulario que en móvil requiere scroll considerable.
- **Guardar exige login pero el login está en la esquina opuesta de la pantalla.**
  El mensaje dice "Inicia sesión con Google (arriba a la derecha)" — instrucción
  posicional, frágil y no accionable. Debería ser un botón ahí mismo.
- **El login está roto en producción** (`redirect_uri_mismatch`, documentado en
  `DECISIONS.md`). Efecto de producto: guardar cotizaciones **no funciona hoy**.

### 2.5 Formularios

- **Los campos no se ven como campos.** El borde `#262d54` contra el panel `#171d3f`
  da **1.24:1** de contraste, y el fondo del input contra el panel da **1.08:1**.
  En la práctica los inputs son invisibles hasta que tienen contenido (ver captura:
  "Aforo (capacidad)" y "Duración" se leen como texto flotante).
- **Los checkboxes se ven como inputs de texto.** "Exclusividad de categoría" y
  "Paga parte con producto" están dentro de cajas con el mismo borde+fondo que un
  campo de texto. El usuario no distingue "escribe aquí" de "prende esto".
- **Sin texto de ayuda salvo en dos campos.** "Caliber del line-up" (además con
  typo: *caliber* → **calibre**), "Tipo de activación" y "Ciudad / venue" son
  decisiones de negocio con consecuencias grandes en el precio y no explican nada.
- **Los presets de territorio son `<button>` sin `aria-pressed`.** Funcionan como
  radio group pero no lo son ni semánticamente ni para lector de pantalla.
- **Sin unidades ni formato en los montos.** `monto_producto` es un `number` crudo:
  el usuario escribe `500000` y ve `500000`, no `$500,000`.

### 2.6 Tablas y listas

- **No hay tablas.** `/cotizaciones` es un `<ul>` con dos datos por fila (nombre +
  fecha, monto a la derecha). No hay orden configurable, ni filtros, ni búsqueda, ni
  paginación, ni acción por fila (ver / duplicar / borrar). Con 30 cotizaciones ya
  no sirve.

### 2.7 Estados vacíos, errores, confirmaciones y feedback

| Estado | Hoy | Problema |
|---|---|---|
| Vacío (cotizador) | 3 párrafos de texto gris | No es un empty state, es relleno; no ofrece acción |
| Vacío (cotizaciones) | "Todavía no has guardado ninguna cotización." | Sin CTA a crear una |
| Cargando (narrativa) | "Generando racional…" en texto | Sin skeleton, sin indicador de progreso |
| Cargando (guardar) | El botón dice "Guardando…" | Correcto |
| Error (narrativa) | Texto rojo suelto | Sin icono, sin reintentar |
| Error (guardar) | `insertError.message` **crudo de Supabase** | Fuga de detalle técnico al usuario final |
| Éxito (guardar) | Texto teal 12px | Sin toast, se pierde de vista; no hay confirmación persistente |
| Confirmaciones | **Ninguna** | No hay operaciones destructivas todavía — pero tampoco hay componente para cuando las haya |

- **No hay `loading.tsx` ni `error.tsx`** en ninguna ruta. Un fallo de servidor en
  `/cotizaciones` muestra la pantalla de error genérica de Next.

---

## 3. UI — problemas encontrados

### 3.1 Tipografía

- **Dos familias sin sistema:** Georgia (serif) para el logo y para el precio; la
  fuente del sistema para todo lo demás. No hay `next/font` — el README dice que el
  proyecto usa Geist, pero **no se carga ninguna fuente**; se está renderizando con
  la stack por defecto del navegador.
- **No hay escala tipográfica.** Se usan `text-xs`, `text-sm`, `text-lg`, `text-2xl`,
  `text-3xl`, `text-4xl` sin criterio: `text-xs` aparece como etiqueta de panel, como
  texto de ayuda, como texto de botón y como mensaje de error — cuatro roles
  distintos con el mismo tamaño.
- **`text-xs` (12px) hace demasiado trabajo.** En una herramienta que se usa horas al
  día, es cansado.

### 3.2 Color

Lo bueno: los ratios de texto están bien.

| Par | Ratio | Veredicto |
|---|---|---|
| `fg` sobre panel | 15.03 | AA ✅ |
| `fg-muted` sobre panel | 6.38 | AA ✅ |
| `accent` sobre bg | 9.20 | AA ✅ |
| `teal` sobre panel | 7.55 | AA ✅ |

Lo malo:

- **`border` sobre panel: 1.24 — FALLA WCAG 1.4.11** (mínimo 3:1 para límites de
  componentes de UI). Aplica a todos los inputs, selects y paneles.
- **No hay color semántico en el sistema.** `--color-accent` (ámbar) se usa a la vez
  para: acción primaria, el número objetivo, el estado activo de un preset, links y
  branding. Un color con cinco significados no comunica ninguno.
- **Los estados semánticos son clases crudas de Tailwind fuera del sistema:**
  `text-red-400` (errores, en 4 archivos), `emerald-500/40`, `amber-500/10`,
  `text-emerald-400`, `text-amber-400` en `ProductoPanel`. No existen `success`,
  `warning`, `danger`, `info` como tokens.
- **El teal no tiene significado definido.** Aparece como barra de rango, como
  confirmación de guardado y como etiqueta de IA — tres cosas distintas.

### 3.3 Espaciado, bordes, radios, sombras

- **Espaciado:** no hay escala documentada; los valores (`gap-6`, `p-6`, `py-2.5`,
  `mb-1.5`, `gap-1.5`, `pb-1.5`) salen de la escala de Tailwind pero sin regla de uso.
- **Radios:** `rounded-md` y `rounded-lg` conviven sin criterio (panel `lg`, input
  `md`, botón `md`) — es defendible pero no está escrito en ningún lado.
- **Sombras: cero.** No hay ni una `shadow-*` en todo el proyecto. La jerarquía de
  elevación se intenta con bordes que además son invisibles (ver 3.2).
- **Sin `focus-visible`.** Los inputs solo hacen `focus:border-aforo-accent` sobre un
  borde que ya casi no se ve; los botones **no tienen ningún estilo de foco** —
  `outline-none` en inputs sin reemplazo. Navegar con teclado es adivinar.

### 3.4 Iconografía

- **No hay iconos.** Ni librería ni SVGs. Se usan caracteres: `←`, `·`, `×`, `▸`.
  Punto a favor: **no se usan emojis como iconografía**, que es lo que había que
  evitar. Punto en contra: sin iconos, una tabla de administración con acciones por
  fila va a ser una fila de links de texto.

### 3.5 Componentes

- **`Panel` es el único componente de sistema que existe** — y no está en todos lados:
  `ProductoPanel` y `RacionalPanel` reimplementan encabezados con la misma cadena
  `text-xs font-semibold uppercase tracking-widest text-aforo-fg-muted`, repetida
  literalmente **5 veces** en 4 archivos.
- **No existen:** Button, Input, Select, Field/Label, Badge, StatusDot, Table, Dialog,
  Drawer, Dropdown, Tabs, Tooltip, Breadcrumb, EmptyState, Skeleton, Alert, Toast.

### 3.6 Responsive

- Móvil (390px) funciona: el grid colapsa a una columna y nada se desborda.
- El header se envuelve razonablemente.
- **Pero:** el orden en móvil deja el resultado por debajo de todo el formulario, y
  no hay indicación de que haya algo abajo tras calcular. El usuario calcula y
  aparentemente no pasa nada.
- El breakpoint de columnas es `lg` (1024px): entre 768 y 1024 se ve una sola columna
  angosta en pantalla ancha — desperdicio en tablets/laptops chicas.

---

## 4. Frontend — deuda técnica

### 4.1 Duplicación medida

| Patrón duplicado | Veces | Archivos |
|---|---|---|
| String de encabezado de sección (`text-xs font-semibold uppercase tracking-widest…`) | 5 | `Panel`, `Cotizador`, `RangoBar`, `ProductoPanel`, `RacionalPanel` |
| `inputClass` (definido local, distinto padding en cada uno) | 2 | `EventoForm`, `ProductoPanel` |
| `labelClass` | 2 | `EventoForm`, `ProductoPanel` |
| Estilo de botón secundario (borde + `bg-input` + hover accent) | 3 | `AuthStatus`, `GuardarCotizacion`, presets de `EventoForm` |
| Bloque `<div><label/><input/><error/></div>` | 6 | `EventoForm` |
| Guard `if (!process.env.NEXT_PUBLIC_SUPABASE_URL)` | 4 | `Header`, `cotizaciones/page`, `route.ts`, `proxy.ts` |
| Wrapper de página `<div className="flex flex-1 flex-col"><Header/>…` | 3 | `page`, `cotizaciones/page` (×2 ramas), `auth/error` |

### 4.2 Componentes demasiado grandes

- `EventoForm.tsx` (270 líneas): 9 campos escritos a mano, cada uno repitiendo la
  misma estructura. Es el archivo que más va a doler cuando se agregue un campo.
- `ProductoPanel.tsx` (212 líneas): mezcla presentación, estado de supuestos y su
  propio subcomponente `Fila`.

### 4.3 Estilos hardcodeados

- Colores fuera del sistema de tokens: `red-400`, `emerald-400/500`, `amber-400/500`
  (ver 3.2).
- `w-28` fijo para las etiquetas de `DesglosePanel` — se rompe si una etiqueta crece.
- `max-w-7xl` repetido en 3 archivos como constante de layout implícita.

### 4.4 Bugs y rarezas encontradas al leer

1. **`RangoBar` no representa el rango.** La barra teal siempre está al 100% y el
   punto del objetivo siempre cae en el mismo lugar: `pct = (objetivo-min)/(max-min)`
   con `min = objetivo*0.75` y `max = objetivo*1.3` da **45.45% constante**, para
   cualquier evento. El gráfico parece informativo y no lo es. *(No es un bug de
   cálculo — el precio está bien; es un bug de visualización.)*
2. **`console.log("Evento a cotizar:", form)` en producción** (`EventoForm.tsx:58`),
   con un comentario que dice "Commit 3: todavía sin fórmula" que ya no aplica.
3. **`DesglosePanel` puede mostrar "0%"** cuando un factor vale exactamente 1.0
   (`log(1) = 0`) — en la captura, "Territorio 0%". Correcto matemáticamente,
   confuso como producto: el usuario lee "el territorio no importa".
4. **Colores alternados por índice** (`i % 2 === 0 ? accent : teal`) en el desglose:
   el color no significa nada, solo alterna.
5. **`AuthStatus` hace `window.location.reload()`** tras cerrar sesión, en vez de
   `router.refresh()`.
6. **Mensaje de error crudo de Supabase** mostrado al usuario (`GuardarCotizacion:107`).
7. **`GuardarCotizacion` vuelve a pedir el usuario al cliente** (`getUser()`) cuando
   el servidor ya lo sabe — round-trip extra y parpadeo.
8. El README sigue siendo el de `create-next-app`; no describe Aforo.

---

## 5. Accesibilidad

| Criterio WCAG | Estado | Detalle |
|---|---|---|
| 1.4.3 Contraste (texto) | ✅ | Todos los pares de texto ≥ 4.5:1 (medido) |
| **1.4.11 Contraste no textual** | ❌ **Falla** | Bordes de input 1.24:1 vs panel (mínimo 3:1) |
| **2.4.7 Foco visible** | ❌ **Falla** | `outline-none` sin reemplazo en inputs; botones sin estilo de foco |
| 1.3.1 Info y relaciones | ⚠️ Parcial | Labels correctos y asociados con `htmlFor` ✅; pero los presets de territorio son botones sin `aria-pressed`, y no hay `<fieldset>/<legend>` para los grupos |
| 3.3.1 Identificación de errores | ⚠️ Parcial | El error se muestra ✅, pero sin `aria-describedby` ni `aria-invalid`, así que un lector de pantalla no lo asocia al campo |
| 4.1.3 Mensajes de estado | ❌ | Ningún `aria-live`: "Guardando…", "Cotización guardada", el resultado del cálculo y los errores no se anuncian |
| 1.3.1 HTML semántico | ⚠️ Parcial | `<header>/<main>/<section>` ✅; `<h1>` es el logo, y las páginas no tienen encabezado propio; los títulos de panel son `<h2>` sin `<h1>` de página que los cuelgue |
| 2.1.1 Teclado | ⚠️ | Todo es alcanzable, pero sin foco visible es inutilizable en la práctica |
| 1.4.10 Reflow | ✅ | 390px sin scroll horizontal |
| 2.4.1 Saltar bloques | ❌ | Sin skip link |
| 1.4.12 Espaciado de texto | ✅ | Sin alturas fijas que corten texto |

**Idioma:** `<html lang="es">` ✅ correcto.

---

## 6. Preparación para lo que viene (usuarios, roles, permisos)

Lo que **bloquea** hoy la construcción de la FASE 4-6:

1. **No hay tabla de perfiles de usuario.** Solo existe `auth.users` de Supabase, que
   no se puede extender con columnas propias (`role`, `status`, `created_by`,
   `last_login`, nombre/apellido).
2. **No hay concepto de autorización, solo de autenticación.** RLS filtra "mis
   cotizaciones" por `auth.uid()`, que es aislamiento por dueño, no control de acceso
   por rol.
3. **No hay capa de acceso a datos (DAL).** Cada componente crea su propio cliente de
   Supabase y pregunta por el usuario por su cuenta (`Header`, `cotizaciones/page`,
   `GuardarCotizacion`, `route.ts`) — 4 lugares que habría que tocar para cada regla
   de permisos, con riesgo de olvidar uno.
4. **`/api/narrativa` no verifica sesión.** Cualquiera con la URL puede gastar la
   cuota de la API de Anthropic del proyecto. Endpoint público que llama a un servicio
   de pago.
5. **`src/proxy.ts` solo refresca la sesión, no protege rutas.** No hay ninguna ruta
   protegida: `/cotizaciones` renderiza para anónimos y solo muestra un mensaje.
6. **No hay rate limiting** en ningún endpoint.
7. **No hay campos de auditoría** (`created_by`, `updated_at`) en `cotizaciones`;
   `creado_en` existe pero no hay `actualizado_en`.

---

## 7. Quick wins (bajo riesgo, alto retorno)

| # | Quick win | Archivo | Esfuerzo |
|---|---|---|---|
| Q1 | Subir el contraste del borde a ≥3:1 y separar el fondo de input del panel | `globals.css` | XS |
| Q2 | Anillo de foco visible global (`:focus-visible`) | `globals.css` | XS |
| Q3 | Quitar el `console.log` de producción y su comentario obsoleto | `EventoForm.tsx:57-58` | XS |
| Q4 | Corregir "Caliber" → "Calibre" | `EventoForm.tsx:117` | XS |
| Q5 | Sustituir el mensaje crudo de Supabase por uno de producto | `GuardarCotizacion.tsx` | XS |
| Q6 | `router.refresh()` en vez de `window.location.reload()` | `AuthStatus.tsx` | XS |
| Q7 | Cargar una fuente real con `next/font` (el README ya la promete) | `layout.tsx` | S |
| Q8 | Skip link + `<h1>` real por página | `layout.tsx`, páginas | S |
| Q9 | `aria-live` en resultado, errores y confirmaciones | 3 componentes | S |
| Q10 | Exigir sesión en `/api/narrativa` | `route.ts` | S |
| Q11 | Arreglar `RangoBar` para que la posición signifique algo | `RangoBar.tsx` | S |
| Q12 | Formatear montos con separador de miles al escribir | `EventoForm.tsx` | S |

## 8. Problemas estructurales (requieren diseño, no parche)

| # | Problema | Impacto |
|---|---|---|
| E1 | No hay design system: tokens semánticos, primitivas ni reglas de uso | Cada pantalla nueva reinventa; la inconsistencia crece lineal con el producto |
| E2 | No hay app shell: sidebar, topbar, breadcrumb, menú de usuario | No hay dónde colgar módulos nuevos |
| E3 | No hay modelo de usuario propio ni RBAC | Bloquea FASES 4-6 completas |
| E4 | No hay DAL: la autorización quedaría dispersa en 4+ lugares | Riesgo de seguridad real, no estético |
| E5 | `/cotizaciones` es una lista, no una tabla de trabajo | No escala más allá de ~20 registros |
| E6 | Endpoint de LLM sin auth ni rate limit | Costo y abuso |
| E7 | Sin `loading.tsx` / `error.tsx` por ruta | Fallos se ven como pantallas rotas de Next |
| E8 | La dependencia de Supabase se toca directo desde componentes de UI | Acopla presentación a infraestructura; dificulta testear |

---

## 9. Prioridades

### P0 — Antes de agregar cualquier funcionalidad nueva

1. **E1 — Design system con tokens semánticos** (`DESIGN-SYSTEM.md` + `globals.css` +
   primitivas). Todo lo demás se construye encima; hacerlo después significa migrar dos veces.
2. **E2 — App shell** (sidebar + topbar + área de contenido con breadcrumb, título y
   acciones). Es el contenedor donde van a vivir Usuarios, Clientes, Reportes.
3. **Q1 + Q2 — Contraste de bordes y foco visible.** Son dos fallas WCAG con arreglo
   de minutos.
4. **E3/E4 — Diseñar (no necesariamente implementar) el modelo User/Role/Permission y
   la DAL** antes de escribir la primera pantalla de administración.
5. **E6/Q10 — Proteger `/api/narrativa`.** Es la única vulnerabilidad con costo
   monetario directo hoy.

### P1 — Siguiente iteración

6. Implementar `profiles` + `roles` + `permissions` + `role_permissions` y la capa
   `can()` en front y `requirePermission()` en server.
7. Módulo Administración → Usuarios, con tabla profesional (búsqueda, filtros por
   status y rol, orden, acciones por fila, sin hard delete).
8. Migrar `/cotizaciones` de lista a tabla del design system.
9. Q3–Q6, Q8, Q9, Q11 (correcciones de UX y accesibilidad).
10. `loading.tsx` + `error.tsx` + `not-found.tsx` por segmento (E7).
11. Rate limiting en endpoints sensibles.

### P2 — Después

12. Flujo de invitación de usuarios (crear → invitar → establecer contraseña → activo).
13. Audit log (`audit_log` con `actor_id`, `action`, `resource`, `before`, `after`, `at`).
14. Refactor de `EventoForm` a definición declarativa de campos.
15. Iconografía (una sola librería, decidir cuál).
16. Q7 (tipografía), Q12 (formato de montos en vivo).
17. Tests de componente / visual regression (hoy solo hay tests de dominio).
18. README real del proyecto.

---

## 10. Qué NO se debe tocar

- **`src/lib/pricing.ts`, `producto.ts`, `territorio.ts` y sus tests.** Están
  calibrados contra deals reales con la evidencia documentada. Esta evolución es de
  interfaz y de plataforma; el motor de precio se queda igual.
- **El stack.** Next 16 + React 19 + Tailwind v4 + Supabase es adecuado para lo que
  se quiere construir. No hay razón técnica para cambiar nada de eso.
- **Las migraciones existentes.** Se agregan migraciones nuevas, no se editan las
  aplicadas.
