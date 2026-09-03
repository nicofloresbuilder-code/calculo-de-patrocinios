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

**Google OAuth — intentado, no cerrado:** se configuró un OAuth Client en Google Cloud Console con el redirect URI de Supabase (`https://ietahcthuejmgjlmgsub.supabase.co/auth/v1/callback`) y se pegaron Client ID/Secret en Supabase Auth → Providers → Google. Al probar el login real, Google regresa `Error 400: redirect_uri_mismatch` — el `redirect_uri` que Supabase manda coincide exactamente con la URL que se pidió registrar, así que el problema es de configuración del lado de Google Cloud (la URL no quedó guardada en el Client correcto, o hay más de un OAuth Client y las credenciales pegadas en Supabase son de uno distinto al que tiene la URL). Se decidió **no seguir depurando esto por ahora** — queda documentado como pendiente conocido, no oculto. Efecto: el botón "Iniciar sesión con Google" no completa el login todavía, por lo que Guardar cotización / Mis cotizaciones (Commit 6) no se pueden probar de punta a punta con un usuario real — el código y las políticas de RLS ya están verificados por separado (ver arriba, curl directo a la REST API).

## Siguiente paso (si se retoma)

1. Resolver el bloqueo de Vercel (revisar billing/verificación de cuenta) y redeploy — deploy 2, cierra Commit 5 y Commit 7 del todo en producción.
2. Depurar `redirect_uri_mismatch` de Google OAuth: en Google Cloud Console → Credentials, confirmar cuántos OAuth Client IDs existen y cuál tiene el redirect URI realmente guardado (con Save dado); asegurar que ese mismo Client ID/Secret sea el que está pegado en Supabase.
3. Con un deal real más (idealmente otro chico o mediano con `oficial`), investigar el sobrepeso de Goleiro: aislar si es `duracion`, la `base` de `oficial`, o ambos, antes de tocar la fórmula otra vez.

---

## Sesión — 2026-08-30 — Deploy 2: se desbloqueó lo que llevaba 15 días trabado

**Contexto:** se retomó Aforo después de terminar Cotejo (Semana 3). Los tres pendientes documentados arriba seguían abiertos; se atacó el primero.

**Qué se encontró:**

1. **El bloqueo de Vercel ya no aplicaba.** Todos los deploys del proyecto seguían con 15 días de antigüedad y status `UNKNOWN`. Pero durante la sesión de Cotejo se hicieron ~8 deploys exitosos con la **misma cuenta** (`dime5`), lo que descartaba una restricción a nivel cuenta. Se corrió `vercel deploy --prod` y quedó `READY` a la primera. **El bloqueo era temporal, no una restricción de billing como se sospechaba.**

2. **El fix de la fórmula del Commit 7 ya estaba vivo** una vez desplegado: probado en el dominio corto con los inputs de Match Cup (aforo 2,000 · 1 día · line-up C · proveedor · tier1) → objetivo **$252,000**, que es el valor corregido (`AFORO_FACTOR_MIN = 0.7`), no los $108,000 de la versión vieja.

3. **La narrativa con IA seguía rota, por una causa distinta a la documentada.** El error en producción era `ANTHROPIC_API_KEY no está configurada en el servidor`, aunque `vercel env ls` sí listaba la variable con el nombre correcto y scope Production. La hipótesis: quedó con **valor vacío** desde el intento manual de hace 15 días (el mismo episodio del typo `anhtropic_api_key`). Como las variables tipo `Secret` no se pueden leer de vuelta, no era verificable — se resolvió **reescribiéndola**: borrar y volver a crear con el valor real, en `production`, `preview` y `development`.

**Resultado — verificado en producción, no supuesto:**
- `POST /api/narrativa` en el dominio público regresa una narrativa real generada por el modelo.
- Flujo completo probado en el navegador sobre la URL en vivo: se llenan las variables de Match Cup → rango $189,000–$327,600, objetivo $252,000 → desglose (Aforo 66%, Ciudad 34%) → narrativa renderizada bajo "POR QUÉ ESTE RANGO", con su etiqueta "Generado por IA · el precio no cambia".
- 7/7 tests de `pricing.test.ts` siguen pasando.

**Nota de transparencia:** la `ANTHROPIC_API_KEY` que se puso es la misma llave que Nicolás proporcionó durante la sesión de Cotejo — su propia llave, en su propio proyecto. Si prefiere una llave separada por proyecto (para poder medir el costo de cada uno por separado, o revocar una sin tumbar la otra), es cambiarla en Vercel y redeployar.

**Pendientes que siguen abiertos** (sin cambio):
1. **Google OAuth `redirect_uri_mismatch`** — el login sigue sin completarse, así que Guardar cotización / Mis cotizaciones no se pueden probar de punta a punta con un usuario real. El código y las policies de RLS ya están verificados por separado con curl.
2. **Sobrestimación de Goleiro (+65.6%)** — sigue esperando un deal real más para aislar si la causa es `duracion`, la `base` de `oficial`, o la interacción de ambos. No se toca sin evidencia; el test de regresión que lo documenta sigue en su lugar.

## Sesión — 2026-08-30 (2) — Territorio + pago en especie

**Qué pidió Nicolás:** agregar el territorio de la activación (2x2 hasta 15x15, personalizable) y el análisis de cuando la marca paga parte del deal con producto.

### Calibración de territorio — con precios reales, no inventados

Nicolás dio 6 precios de referencia. Los 4 del Grupo A varían **solo** el territorio (15,000 pers · 2 días · line-up B · CDMX · oficial · con exclusividad), que es exactamente lo que se necesita para aislar la variable:

| Territorio | Su precio | $/m² | $/metro lineal |
|---|---|---|---|
| 2×2 | $400,000 | $100,000 | $200,000 |
| 5×5 | $1,200,000 | $48,000 | $240,000 |
| 10×10 | $2,000,000 | $20,000 | $200,000 |
| 15×15 | $3,200,000 | $14,222 | $213,333 |

**Hallazgo:** el precio por m² se desploma (100K → 14K), pero **el precio por metro lineal de lado se mantiene casi constante** (~200–240K). Su intuición comercial cobra por **frente/visibilidad**, no por superficie. Por eso el factor se ancla al lado en metros, no al área — modelarlo por m² habría producido precios absurdos en los extremos.

**Segundo hallazgo:** al derivar el factor, el 5×5 sale en **1.00**. O sea, el 5×5 ya era el estándar implícito de la fórmula anterior (que sin territorio daba $1,190,250 para ese evento, contra los $1,200,000 que él cotiza para 5×5). Anclar ahí significa que **agregar territorio no recalibra nada de lo ya validado** — las cotizaciones históricas siguen siendo consistentes.

Se implementó como interpolación lineal entre las 4 anclas reales, en vez de ajustar una curva. Son sus datos, no una función inventada. Fuera del rango se extrapola con la pendiente del tramo extremo.

**Verificado:** los 4 casos reproducen sus precios con <1.2% de desvío (probado en el navegador, no solo en tests). B1 (evento chico) queda a +5%.

### Hallazgo importante: `naming` está sobrevaluado en la fórmula

El caso B2 (45,000 pers · 3 días · line-up A · CDMX · **naming** · exclusiva · 10×10) él lo cotiza en **$6,500,000**. La fórmula da **$20.6M** — +217%.

Se aisló la causa comparando contra un deal real del mismo perfil:

- Ultra México, **oficial**, real cerrado: **$5,000,000**
- B2, **naming**, cotizado por él: **$6,500,000**
- → en sus precios reales, `naming` vale **1.3×** lo que `oficial`
- → pero la fórmula asume **2.5×** (base $2M vs $800K)

**No se corrigió todavía**, por dos razones: la base de `naming` se calibraría con solo 2 puntos, y —más importante— **no sabemos qué territorio tenían los deals históricos**. El match de -1.7% de Ultra en el Commit 7 asumía implícitamente un territorio; si Ultra tenía una activación grande (probable en un deal de $5M), la base estaba sobreajustada. Corregir `naming` sin saber eso sería cambiar un número por otra corazonada.

Queda un test que **documenta el desvío en vez de esconderlo** (`territorio.test.ts`), y que truena a propósito si alguien lo arregla, para forzar que se actualice con el número nuevo.

### Pago en especie (`src/lib/producto.ts`)

El modelo real: un deal de $1M puede cerrarse 50/50 — $500K en efectivo y $500K en producto. Ese producto no cuesta (es parte del pago), se vende en el festival, y **toda la venta es margen**.

La pregunta que contesta el módulo no es "cuánto vendemos" sino **si ese producto se puede hacer líquido** — palabras de Nicolás: *"lo importante es que nosotros lo podamos hacer líquido fácilmente"*.

```
unidadesRecibidas   = montoEnProducto / precio declarado por la marca
capacidadVenta      = aforo × días × consumo por persona/día
unidadesVendibles   = min(recibidas, capacidad)
ingreso             = vendibles × precio de venta en festival
montoMáximoRecomendado = capacidad × precio declarado
```

Los tres supuestos (valor declarado, precio de venta, consumo) son **editables en pantalla y están marcados como supuestos** — Nicolás no tiene los números históricos todavía, así que se propusieron defaults en vez de fingir precisión.

**Verificado en el navegador con sus dos escenarios:**
- Evento de 15,000 × 2 días + $500K en producto → se liquida completo, ingreso $2,333,333, múltiplo **4.67×**. El deal presentado como $3.2M **vale $5.03M**.
- Mismo producto en evento de 2,000 × 1 día → solo absorbe 4,000 de 33,333 unidades. Sobran **$440,000 de valor muerto**, múltiplo cae a **0.56×**, y el deal **vale menos** de lo que aparenta. Máximo recomendado: $60,000.

Ese segundo caso es el que justifica la feature: sin él, un deal 50/50 en evento chico se vería igual de bueno que en uno grande.

### Base de datos

`supabase/migrations/0002_territorio_producto.sql` agrega `territorio_lado`, `paga_con_producto` y `monto_producto` a `cotizaciones`, y marca las cotizaciones viejas con `territorio_lado = 5` (el estándar implícito) en vez de dejarlas en NULL. **Pendiente de correr** en el SQL Editor — sin eso, Guardar cotización fallará. No hay regresión porque hoy ya está bloqueado por el pendiente de Google OAuth.

**Tests:** 26/26 (10 nuevos: 8 de territorio anclados a sus precios reales, y los de producto incluyendo el caso de valor muerto).

### Recalibración de `naming` (misma sesión)

Se bajó `BASE_ACTIVACION.naming` de **$2,000,000 a $1,650,000**, con lo que B2 pasa de $20.6M a **$17,027,010** (+0.2% del precio que fijó Nicolás).

**Cómo se llegó al número, porque importa para quien lo revise después:** Nicolás cotizó B2 primero en $6.5M. Se le mostró que la fórmula daba $20.6M y el análisis de que `naming` valía 1.3x `oficial` en sus precios contra 2.5x en la fórmula. Entonces revisó su propio número a $17M ("tienes razón").

Se le señaló explícitamente el riesgo de anclaje —que el número de la fórmula se le presentó **antes** de que revisara el suyo— y aun así decidió $17M. Se aplica porque él es quien conoce el mercado, pero queda anotado en el código y en el test que **este ancla es más débil que las otras**: no es un precio observado en frío ni un deal cerrado, a diferencia de Ultra México ($5M real). Si alguien recalibra en el futuro, debe pesar Ultra por encima de B2.

`naming` queda en 2.06x `oficial`.

### Estado de la calibración: 8 de 9 anclas

| Caso | Evidencia | Real/fijado | Fórmula | Desvío |
|---|---|---|---|---|
| A1 2×2 | cotizado | $400,000 | $404,685 | +1.2% |
| A2 5×5 | cotizado | $1,200,000 | $1,190,250 | −0.8% |
| A3 10×10 | cotizado | $2,000,000 | $1,999,620 | −0.0% |
| A4 15×15 | cotizado | $3,200,000 | $3,201,772 | +0.1% |
| B1 | cotizado | $300,000 | $315,000 | +5.0% |
| B2 naming | revisado | $17,000,000 | $17,027,010 | +0.2% |
| Ultra México | **deal real** | $5,000,000 | $4,914,000 | −1.7% |
| Match Cup | **deal real** | $300,000 | $252,000 | −16.0% |
| **Goleiro** | **deal real** | $1,000,000 | $1,656,000 | **+65.6%** |

### Goleiro: descartada la hipótesis de `duracion`

Con el Grupo A ahora disponible se pudo probar la sospecha que quedó abierta en el Commit 7 (que el desvío de Goleiro venía de `duracion` sobre-pesada). **No es eso**, y la comparación lo deja claro:

- A2 — 15,000 pers · **2 días** · line-up B · oficial · exclusiva · 5×5 → él cotiza **$1,200,000**
- Goleiro — 15,000 pers · **5 días** · line-up B · oficial · exclusiva → cerró en **$1,000,000**

Goleiro es **más largo y más barato** que su propia cotización de la versión de 2 días. Para que la fórmula lo reprodujera, el factor de duración a 5 días tendría que ser ~0.97 — menos que 1.0, o sea que un evento de 5 días valdría menos que uno de 1 día. Eso no es una curva de duración, es señal de que la diferencia está en otra parte.

**Hipótesis nueva a probar (no aplicada):** que `aforo` esté mal definido — si en Goleiro los 15,000 son asistencia **total repartida en 5 días** (~3,000/día) y en el Grupo A son 15,000 **por día**, la fórmula está multiplicando aforo × duración sobre la misma gente y duplicando el conteo. Falta confirmarlo con Nicolás antes de tocar nada.

### Goleiro resuelto (la causa, no todavía el arreglo)

Nicolás confirmó los dos datos que faltaban: **Goleiro fueron 15,000 asistentes EN TOTAL repartidos en los 5 días (~3,000/día), con territorio 10×10.**

Con eso, Goleiro y el caso A3 forman un **par controlado** — idénticos en absolutamente todo salvo los días:

| | A3 (cotizado) | Goleiro (cerrado) |
|---|---|---|
| asistencia | 15,000 total | 15,000 total |
| **días** | **2** | **5** |
| line-up | B | B |
| ciudad | CDMX tier1 | CDMX tier1 |
| activación | oficial | oficial |
| exclusividad | sí | sí |
| territorio | 10×10 | 10×10 |
| **precio** | **$2,000,000** | **$1,000,000** |

**Misma gente, mismo espacio, mismo todo — repartida en 5 días en vez de 2, vale la mitad.** (7,500/día vs 3,000/día.)

La fórmula hace exactamente lo contrario: multiplica `aforo` × `duracion`, o sea cuenta la misma gente cinco veces **y encima premia por durar más**. De ahí el +65.6%.

**El arreglo no es un coeficiente, es estructural:** el driver debería ser la **densidad** (asistentes/día), no el total multiplicado por duración.

### Explorando el modelo de densidad — dos hallazgos más

Despejando qué factor de densidad exige cada ancla (quitando base, line-up, exclusividad, ciudad y territorio):

| Caso | gente/día | factor exigido |
|---|---|---|
| B1 | 2,000 | 0.667 |
| Goleiro | 3,000 | 0.431 |
| A1–A4 | 7,500 | 0.853 – 0.870 |
| B2 | 15,000 | 2.920 |

**Hallazgo 1 — el territorio queda confirmado.** Los cuatro casos del Grupo A, que solo difieren en territorio, exigen el *mismo* factor de densidad (0.853–0.870, ±1%). Eso significa que el factor de territorio ya absorbe correctamente toda la diferencia entre ellos. Es validación independiente de la calibración.

**Hallazgo 2 — parece haber un PISO de precio, no una curva.** B1 (2,000/día) exige 0.667, más que Goleiro (3,000/día) con 0.431. Eso rompe la monotonía: menos gente no debería valer más. La explicación probable es un mínimo comercial:

- Match Cup — 2,000 pers · **sin** exclusividad → **$300,000** (real)
- B1 — 2,000 pers · **con** exclusividad → **$300,000** (cotizado)

Mismo precio con y sin exclusividad. El factor de 1.25 de exclusividad no mueve nada porque ambos están pegados al piso. **$300,000 parece ser el mínimo por debajo del cual no vale la pena vender un patrocinio**, sin importar qué diga la fórmula.

Si se confirma, el modelo sería `max(PISO, fórmula)` — y explicaría de paso el -16% que quedó pendiente en Match Cup desde el Commit 7.

**Bloqueante antes de recalibrar:** falta confirmar si el "15,000 personas" del Grupo A también es total (como Goleiro) o por día. Si fuera por día, todo este análisis cambia. También sigue sin saberse el territorio de Ultra México — y ahí hay una pista: si Ultra tuvo 5×5, su factor de densidad sale en 2.976, casi idéntico al 2.920 de B2 con la misma densidad (15,000/día). Eso lo haría consistente.
