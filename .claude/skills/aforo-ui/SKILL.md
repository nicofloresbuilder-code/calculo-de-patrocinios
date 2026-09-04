---
name: aforo-ui
description: Construir o modificar interfaz en Aforo — pantallas, componentes, formularios, tablas, estados vacíos/carga/error, estilos y accesibilidad. Úsala ANTES de escribir cualquier JSX o CSS en este repositorio, y cuando haya que revisar visualmente una pantalla ya modificada. Cubre los tokens del design system, las primitivas disponibles, el checklist de accesibilidad y el bucle de QA visual con capturas reales.
---

# Interfaz en Aforo

Herramienta interna de pricing. Densidad alta, sobria, orientada a
productividad. Lee `DESIGN-SYSTEM.md` en la raíz para los valores; esto es el
procedimiento.

## Antes de escribir código

1. `PRODUCT-UI-AUDIT.md` — problemas ya identificados y sus prioridades.
2. `DESIGN-SYSTEM.md` — tokens, reglas de uso, tabla de contrastes.
3. `src/components/ui/index.ts` — qué primitivas existen ya.
4. **Next.js 16 tiene cambios de API respecto a versiones anteriores.**
   Consulta `node_modules/next/dist/docs/` antes de usar una API del
   framework. En particular: el middleware ahora se llama **Proxy**
   (`src/proxy.ts`, no `middleware.ts`).

## Reglas que no se negocian

1. **Nada hardcodeado.** Ni un color, radio, altura de control o tamaño de
   texto fuera de los tokens. Nunca `text-red-400`, `bg-emerald-500/10` ni
   equivalentes: si falta un tono, se agrega al token.
2. **Reutiliza la primitiva.** ¿Es una variante? Agrégala a la primitiva. Solo
   se crea un componente nuevo si de verdad es un concepto nuevo, y entonces
   va en `src/components/ui/`, se exporta en `index.ts` y se documenta en
   `DESIGN-SYSTEM.md` §6.
3. **Una sola acción primaria por vista.**
4. **Ningún `outline-none` sin reemplazo.** El anillo de foco es global en
   `globals.css`.
5. **El color nunca es la única señal.** Badge = punto + texto. Alert = icono.
   Item activo = barra indicadora + contraste.
6. **Formularios siempre con `<Field>`**, que ya cablea `aria-invalid` y
   `aria-describedby`. No escribas `<label>` + `<input>` sueltos.
7. **`EmptyState` dice qué falta y ofrece la acción.** Un párrafo gris no es
   un estado vacío.
8. **Sin emojis como iconografía.** Usa `<Icon name="…">`.
9. **Cada pantalla nueva** usa `PageHeader` (breadcrumb → `<h1>` → acciones) +
   `PageBody`.
10. **No introduzcas librerías de UI ni de iconos.** El proyecto es Tailwind v4
    a secas, a propósito.

## Estados obligatorios

Toda vista que cargue datos necesita los cuatro: **vacío · cargando · error ·
con datos**. Cargando usa `Skeleton`/`SkeletonText` con la forma del contenido
real, no un spinner genérico ni texto suelto.

## Accesibilidad — checklist antes de dar por hecho

- [ ] Foco visible en todo lo enfocable (no se rompió el anillo global).
- [ ] Un solo `<h1>` por página, en `PageHeader`.
- [ ] Errores de formulario asociados al campo (usar `Field`).
- [ ] Cambios de estado importantes anunciados (`role="status"` / `aria-live`).
- [ ] Controles con nombre accesible (label real, o `aria-label` en botones de
      solo icono).
- [ ] Grupos de opciones excluyentes con `role="radiogroup"` + `aria-checked`
      (usa `SegmentedControl`).
- [ ] Sin scroll horizontal a 390px.
- [ ] Si tocaste un color: volver a correr la verificación de contraste (abajo).

## Bucle de QA visual — obligatorio tras modificar una pantalla

Compilar no es evidencia de que se ve bien.

```bash
npm run lint && npx tsc --noEmit && npm test
npx next dev -p 3000    # en segundo plano
```

Playwright está instalado globalmente en el entorno (no en el proyecto):

```js
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
```

Captura y revisa **en 1440×900, 820×1000 y 390×844**. Busca: desbordes,
texto cortado, botones apretados, tablas rotas, espaciado inconsistente,
estados hover/focus, y los cuatro estados de datos.

Comprueba desborde horizontal en cada tamaño:

```js
await page.evaluate(() =>
  document.documentElement.scrollWidth > document.documentElement.clientWidth);
```

Usa `getByLabel()` / `getByRole()` para interactuar: si el selector
accesible no encuentra el control, ahí tienes un bug de accesibilidad.

**Ojo con las capturas `fullPage`:** los elementos `sticky` (la barra
superior) se dibujan en su posición desplazada y parecen solaparse. Para
juzgar el layout, usa capturas de viewport.

## Verificación de contraste

Al cambiar cualquier color, comprueba contra WCAG 2.1: **texto ≥ 4.5:1**,
**límites de control ≥ 3:1** (SC 1.4.11). Fórmula de luminancia relativa:

```js
const hx = h => [1,3,5].map(i => parseInt(h.slice(i,i+2),16));
const lin = c => { c/=255; return c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)**2.4; };
const L = rgb => { const [r,g,b] = rgb.map(lin); return 0.2126*r+0.7152*g+0.0722*b; };
const ratio = (a,b) => { const [x,y]=[L(a),L(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
```

Actualiza la tabla de `DESIGN-SYSTEM.md` §2.3 con los valores nuevos.

## No tocar

`src/lib/pricing.ts`, `producto.ts` y sus tests están calibrados contra deals
reales, con la procedencia documentada en `DECISIONS.md`. Los cambios de
interfaz no tocan el motor de precio.
