# DESIGN-SYSTEM — Aforo

Sistema de diseño de la plataforma interna. Los valores viven en
`src/app/globals.css` (tokens de Tailwind v4) y las primitivas en
`src/components/ui/`. **Este documento explica el porqué y las reglas de uso;
el código es la fuente de verdad de los valores.**

**Stack:** Tailwind CSS v4 con `@theme inline` (sin `tailwind.config.js`).
No se agregó ninguna librería de componentes ni de iconos: el proyecto ya
tenía Tailwind y no había razón técnica para introducir otra dependencia.

---

## 1. Dirección visual

Herramienta interna de productividad, no un sitio de marketing.

**Sí:** superficie oscura sobria, densidad alta, una sola acción primaria por
pantalla, números tabulares, jerarquía por tipografía y superficie.

**No:** gradientes, sombras dramáticas, todo dentro de cajas, animaciones
decorativas, emojis como iconografía, colores sin significado.

**Jerarquía de superficie** — la elevación se expresa con la luminosidad de
la superficie, no con sombras. La sombra solo aparece cuando algo flota de
verdad sobre la página (dropdown, dialog).

```
canvas   #080B1A   fondo de la app, topbar
sunken   #0C1029   pozos: campos de formulario, encabezado de tabla
surface  #101533   cards, paneles, barra lateral
raised   #171D3F   dropdowns, dialogs, fila de tabla en hover, card destacada
```

---

## 2. Color

### 2.1 Tokens

| Token | Valor | Para qué |
|---|---|---|
| `canvas` / `sunken` / `surface` / `raised` | ver arriba | superficies |
| `line-subtle` | `#242B54` | divisores decorativos dentro de una superficie |
| `line` | `#5C66A0` | **límite de control** (input, select, botón secundario) |
| `line-strong` | `#737EBA` | hover / énfasis |
| `fg` | `#F2F4FB` | texto principal |
| `fg-muted` | `#A6ADCC` | etiquetas, texto secundario |
| `fg-subtle` | `#858DB8` | metadatos, ayuda, placeholders |
| `primary` | `#F0A83C` | marca + acción primaria |
| `primary-hover` | `#FFBC5C` | hover de la acción primaria |
| `primary-fg` | `#0A0E1F` | texto sobre `primary` |
| `info` | `#2EC4B6` | informativo / en curso |
| `success` | `#3DD68C` | estado sano, operación completada |
| `warning` | `#FB923C` | requiere atención, todavía no es fallo |
| `danger` | `#FF6B6B` | error o acción destructiva |
| `neutral` | `#A6ADCC` | estado sin carga (INACTIVE, "sin asignar") |

El ámbar `#F0A83C` es el color de marca que ya tenía el producto y **se
conserva tal cual**. Lo que cambió es su gobierno: antes significaba cinco
cosas a la vez (marca, acción primaria, la cifra, el estado activo de un
preset, y los enlaces). Ahora significa exactamente dos, que además son la
misma idea: *"esta es la acción"* y *"este es el número que importa"*.

### 2.2 Reglas de uso (las que evitan que el sistema se degrade)

1. **Un tono semántico significa siempre lo mismo.** `warning` nunca es
   decorativo; `success` nunca es "es bonito que sea verde".
2. **`primary` no es un estado.** Nunca aparece en un `Badge` de estado.
   Warning (naranja) y primary (ámbar dorado) son matices vecinos: se
   distinguen porque un estado SIEMPRE viene como píldora con punto y
   etiqueta, y la marca NUNCA. Si un día hay que elegir, gana el semántico.
3. **El color nunca es la única señal.** Los `Badge` llevan punto + texto; el
   item activo de la barra lateral lleva una barra indicadora además del
   contraste; los `Alert` llevan icono. (WCAG 1.4.1)
4. **Nada de colores crudos de Tailwind** (`text-red-400`, `bg-emerald-500/10`).
   Antes había cuatro archivos usándolos. Si falta un tono, se agrega al
   token, no al componente.

### 2.3 Contraste verificado

Todos los pares se midieron programáticamente contra WCAG 2.1 antes de fijar
los valores. Al cambiar cualquier color hay que volver a correr esa
verificación.

**Texto (mínimo 4.5:1)** — sobre las cuatro superficies:

| | canvas | sunken | surface | raised |
|---|---|---|---|---|
| `fg` | 17.81 | 17.03 | 16.23 | 14.88 |
| `fg-muted` | 8.83 | 8.44 | 8.05 | 7.38 |
| `fg-subtle` | 6.06 | 5.79 | 5.52 | 5.06 |
| `primary` | 9.66 | 9.25 | 8.81 | 8.08 |
| `info` | 9.03 | 8.64 | 8.23 | 7.55 |
| `success` | 10.43 | 9.98 | 9.51 | 8.72 |
| `warning` | 8.65 | 8.27 | 7.88 | 7.23 |
| `danger` | 7.05 | 6.75 | 6.43 | 5.89 |

`primary-fg` sobre `primary` = **9.47** (texto del botón primario).

**Límites de componentes (WCAG 1.4.11, mínimo 3:1)** — `line` contra
canvas 3.60 · sunken 3.44 · surface 3.28 · raised 3.01.

> Este es el arreglo más importante de la auditoría: el borde anterior
> (`#262D54`) daba **1.24:1** contra el panel y el fondo del input daba
> **1.08:1**. Los campos eran literalmente invisibles hasta que tenían
> contenido. Ahora el campo se distingue por dos señales independientes:
> borde a 3:1 **y** fondo `sunken` distinto del `surface` que lo contiene.

**Badges** — texto sobre tinte al 15% ≥ 5.26:1; borde al 65% ≥ 3.34:1.

### 2.4 Tema claro

No existe todavía y no hace falta. La estructura ya lo permite: los valores
crudos están en `:root` como `--raw-*` y el mapa semántico en `@theme inline`.
Agregar un tema claro es redefinir el bloque `--raw-*` bajo un selector; ni
un componente cambia.

---

## 3. Tipografía

**Una sola familia de interfaz: Inter**, cargada con `next/font/google`
(auto-hospedada, sin petición a terceros en runtime). Antes no se cargaba
ninguna fuente — el README prometía Geist y el navegador renderizaba con su
stack por defecto.

La serif (`--font-display`, Georgia del sistema) queda **solo para el
wordmark**. La cifra grande de precio pasó de serif a Inter con números
tabulares: en una herramienta de pricing los números se comparan en columna
y tienen que alinearse.

`font-variant-numeric: tabular-nums` está activo en `body`, para toda la app.

### Escala y rol de cada paso

| Token | px | Para qué |
|---|---|---|
| `text-2xs` | 11 | overlines de sección, badges, etiquetas de tabla |
| `text-xs` | 12 | texto de ayuda, metadatos, breadcrumb |
| `text-sm` | 13 | **base de la UI**: labels, celdas, botones, cuerpo denso |
| `text-base` | 15 | prosa y descripciones largas |
| `text-lg` | 18 | título de página (`<h1>`) |
| `text-xl` | 24 | métrica secundaria |
| `text-2xl` | 32 | métrica principal |
| `text-3xl` | 44 | la cifra hero (objetivo de cierre) |

**Regla:** un tamaño = un rol. El problema anterior era que `text-xs` hacía
de etiqueta de panel, texto de ayuda, texto de botón y mensaje de error a la
vez.

---

## 4. Espaciado, radios, sombras, movimiento

**Espaciado** — escala de 4px (la de Tailwind). Uso convenido:

| Paso | Para qué |
|---|---|
| `1` (4px) | icono ↔ texto |
| `1.5`–`2` (6–8px) | dentro de un componente |
| `3` (12px) | entre campos relacionados |
| `4` (16px) | entre campos, entre cards |
| `5` (20px) | padding interno de card |
| `6`+ (24px+) | entre bloques de una página |

**Altura de controles** — `control-sm` 28px · `control` 36px (default) ·
`control-lg` 40px. Todo control interactivo mide uno de estos tres.

**Radios** — `sm` 4px (badge, checkbox) · `md` 6px (botón, input, select) ·
`lg` 8px (card, panel) · `xl` 12px (dialog, drawer).

**Sombras** — `sm` para separar del plano, `md` para card destacada, `lg`
solo para overlays. En una interfaz oscura la sombra confirma la elevación;
no la crea.

**Movimiento** — 150ms `ease-out` para color y hover. Nada más. `globals.css`
respeta `prefers-reduced-motion`.

---

## 5. Iconografía

Set propio en `src/components/ui/Icon.tsx`: 24×24, `stroke-width` 1.75,
`currentColor`, ~19 glifos. **Cero dependencias.**

- `size={16}` dentro de texto y botones · `size={20}` en navegación.
- Sin `label` el icono es decorativo (`aria-hidden`); con `label` se expone
  como `role="img"`.
- **Nunca emojis como iconografía.**
- Si el set pasa de ~30 glifos, migrar a `lucide-react`: usa la misma
  convención y el cambio es mecánico.

---

## 6. Primitivas

Todas en `src/components/ui/`, exportadas desde `src/components/ui/index.ts`.

| Componente | Notas de uso |
|---|---|
| `Button` | `variant`: `primary` · `secondary` · `ghost` · `danger`. **Una sola primaria por vista.** `type="button"` por defecto para no enviar formularios por accidente. |
| `LinkButton` | Enlace con apariencia de botón. Si la acción navega, el elemento debe ser `<a>` — nunca `<button>` dentro de `<a>`. |
| `Card` / `CardTitle` | Contenedor de sección. `flush` para tablas a sangre, `raised` para destacar. Sustituye al antiguo `Panel`. |
| `Field` | Label + hint + error con **`aria-describedby` y `aria-invalid` ya cableados**. Usa render prop: el control recibe el `id` resuelto. |
| `Input` / `Select` | Comparten `controlClass`: misma altura, mismo borde, mismo padding. |
| `Checkbox` | Fila accionable con `role="switch"`; toda el área es clickeable. Ya no parece un campo de texto. |
| `SegmentedControl` | `role="radiogroup"` + `aria-checked`. Antes eran `<button>` sueltos que parecían un radio group sin serlo. |
| `Badge` | Estado. `tone` + `dot`. Nunca `primary` para estados. |
| `Alert` | `role="alert"` cuando es `danger`, `role="status"` en el resto. |
| `EmptyState` | **Siempre dice qué falta y ofrece la acción.** Un párrafo gris no es un estado vacío. |
| `Skeleton` / `SkeletonText` | Placeholder con la forma del contenido que va a llegar. |
| `Table` + `THead`/`TBody`/`TR`/`TH`/`TD` | Scroll horizontal dentro de la tabla, nunca en la página. `numeric` alinea a la derecha. |
| `Metric` | La cifra destacada. Un solo lugar decide cómo se ve "el número que importa". |

### Shell — `src/components/shell/`

| Componente | Rol |
|---|---|
| `AppShell` | Sidebar + topbar + área de contenido. Skip link. Sidebar fija ≥1024px, panel deslizante debajo. |
| `Sidebar` | Módulos. Recibe las secciones **ya filtradas por permisos desde el servidor**. |
| `UserMenu` | Sesión, rol y cerrar sesión. Es donde después cuelgan perfil y preferencias. |
| `PageHeader` / `PageBody` | Breadcrumb → `<h1>` → descripción → acciones primarias. Patrón común de todas las pantallas. |

---

## 7. Accesibilidad — reglas que el sistema garantiza

1. **Foco visible siempre.** `globals.css` pinta un anillo `:focus-visible`
   global. **Ningún componente puede hacer `outline-none` sin reemplazo.**
   (Antes: los inputs lo hacían y los botones no tenían foco.)
2. **Límites de control a 3:1** (WCAG 1.4.11), verificado arriba.
3. **Errores asociados al campo** vía `Field` (`aria-invalid` +
   `aria-describedby`), no solo texto rojo debajo.
4. **Mensajes de estado anunciados** (WCAG 4.1.3): el resultado del cálculo,
   el resumen de validación del formulario y el estado del racional usan
   `role="status"` / `aria-live`.
5. **Skip link** al contenido (WCAG 2.4.1).
6. **Un `<h1>` por página**, en `PageHeader`. El wordmark ya no es el `<h1>`.
7. **El color nunca es la única señal** (ver §2.2).
8. Sin scroll horizontal a 390px. Verificado en 390 / 820 / 1440.

---

## 8. Autorización en la interfaz

`Can` y `usePermissions()` (`src/components/auth/`) son la capa reutilizable:

```tsx
<Can permission="users.create">
  <Button variant="primary" icon="plus">Nuevo usuario</Button>
</Can>

const { can, hasRole } = usePermissions();
if (can("users.edit")) { … }
```

El contexto lo calcula el servidor una sola vez (`getAuthzContext()`) y baja
por props al `AuthzProvider`. El cliente **nunca** lo deriva por su cuenta.

> **Esconder un control no es seguridad.** Toda operación sensible se vuelve
> a verificar en el servidor con `requirePermission()`. Ver
> `RBAC-ARCHITECTURE.md`.

---

## 9. Cómo agregar algo al sistema

1. ¿Ya existe una primitiva que sirva? Úsala.
2. ¿Es una variante? Agrega la variante a la primitiva, no un componente nuevo.
3. ¿Es un componente nuevo? Va en `src/components/ui/`, se exporta en
   `index.ts` y se documenta en la tabla de §6.
4. **Nunca** hardcodees un color, un radio o una altura de control fuera de
   los tokens.
5. Si agregas o cambias un color, vuelve a correr la verificación de
   contraste antes de commitear.
