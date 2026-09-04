# SECURITY-AUDIT — Aforo

Auditoría de seguridad del proyecto completo y registro de las correcciones
aplicadas.

**Fecha:** 2026-09-04
**Base auditada:** `ed7514d` (post design system + RBAC)
**Alcance:** código de aplicación, configuración, base de datos, dependencias
e historial de Git.

**Método:** lectura del código; escaneo de los 151 blobs del object store de
Git; `npm audit`; build de producción + `next start` con verificación de
cabeceras HTTP reales; navegador real (Chromium) comprobando violaciones de
CSP; 63 tests automatizados.

---

## 0. Stack identificado (los controles se eligieron contra esto, no contra una plantilla)

| Capa | Tecnología | Consecuencia para la seguridad |
|---|---|---|
| Frontend | Next.js 16.3.1 App Router, React 19 | React escapa por defecto ⇒ XSS solo si se usa HTML crudo |
| Backend | Route Handlers de Next (no hay servidor aparte) | La autorización vive en la misma app; no hay gateway que la imponga |
| Base de datos | Supabase (Postgres 15+) | **Soporta RLS** ⇒ control #4 aplica de lleno |
| ORM | **Ninguno.** Cliente REST de `supabase-js` (PostgREST) | No hay SQL construido a mano ⇒ superficie de inyección casi nula |
| Auth | Supabase Auth (Google OAuth) | Hashing y tokens delegados ⇒ controles #5 y #10 son "no implementar nada propio" |
| Sesión | Cookies vía `@supabase/ssr`, refresco en `src/proxy.ts` | Los defaults del paquete **no** eran seguros (ver #9) |
| Hosting | Vercel | HTTPS y redirección HTTP→HTTPS automáticas ⇒ #19 casi resuelto por plataforma |
| Serverless | Funciones sin estado compartido | **Limita el rate limiting en memoria** (ver #11) |
| Storage | **No se usa.** Sin subida de archivos | #16 NOT APPLICABLE hoy |
| Entorno | Variables de Vercel + `.env.local` | `NEXT_PUBLIC_` = público; el resto, servidor |
| Paquetes | npm, `package-lock.json` | `npm audit` es la herramienta correcta |

---

## 1. Los 20 controles

### #1 — HIDE API KEYS · **FIXED** · severidad HIGH (era)

**Estado antes:** la separación pública/privada era correcta en el código,
pero no estaba verificada y había una fuga menor de información.

**Verificado:**
- `.next/static` (bundle del navegador) no contiene `ANTHROPIC_API_KEY`,
  `sk-ant`, `SERVICE_ROLE` ni `AFORO_SUPER_ADMIN_EMAILS` — 0 coincidencias.
- Clasificación explícita, ahora documentada en `.env.example`:

| Variable | Clase | Dónde vive |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Pública por diseño** | Bundle del navegador |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Pública por diseño** | Bundle del navegador |
| `SUPABASE_SERVICE_ROLE_KEY` | **SECRETA — ignora RLS** | Solo servidor |
| `ANTHROPIC_API_KEY` | **SECRETA — cuesta dinero** | Solo servidor |
| `AFORO_SUPER_ADMIN_EMAILS` | **Sensible** | Solo servidor |

**Corregido:** el mensaje de error de `/api/narrativa` revelaba el nombre de
la variable de entorno al cliente (`"ANTHROPIC_API_KEY no está configurada
en el servidor"`). Ahora ese detalle va a `console.error` y al usuario le
llega un mensaje de producto.

**Archivos:** `.env.example`, `src/app/api/narrativa/route.ts`,
`src/lib/supabase/admin.ts`

> Ninguna clave privada se volvió pública para resolver nada.

---

### #2 — PURGE GIT SECRETS · **SECURE** · sin acción

**Escaneado:** los 22 commits y **los 151 blobs** del object store, incluidos
objetos no alcanzables desde ninguna rama.

Patrones buscados: `sk-ant-api…`, JWT (`eyJhbGciOi….eyJ…`), `-----BEGIN …
PRIVATE KEY-----`, cadenas de conexión `postgres://usuario:contraseña@`,
`AKIA…` (AWS), `ghp_…` (GitHub), `xox…` (Slack).

**Resultado: 0 valores de secreto en todo el historial.**

Las únicas coincidencias fueron **menciones del nombre** de las variables en
documentación y comentarios (`BUILD_PROMPT.md:127`, `src/lib/supabase/server.ts:7`).
Eso no es una fuga.

`.gitignore` cubre correctamente `.env*` con excepción `!.env.example`, y
`.env.example` nunca ha contenido valores.

**Rotación necesaria: ninguna** por exposición en el repositorio.

> ⚠️ Con una salvedad honesta: este escaneo cubre **este** repositorio.
> `DECISIONS.md` documenta que la `ANTHROPIC_API_KEY` se pegó a mano en la
> consola de Vercel en varias ocasiones y que se compartió entre dos
> proyectos. Eso no es una fuga del repo, pero sí una razón independiente
> para rotarla — ver §5.

---

### #3 — USE PUBLIC DATABASE KEYS CORRECTLY · **FIXED** · severidad HIGH (era)

**Aplica**: Supabase es exactamente esta arquitectura.

**Estado antes:** la anon key se usaba bien (solo en cliente), pero el
proyecto **confiaba en ella como si diera autorización**: la política de
`comparables` era `using (true)`, así que la anon key —que es pública por
diseño y viaja en el bundle— bastaba para leer la tabla entera. Ver #4.

**Corregido:**
- `src/lib/supabase/admin.ts`: cliente `service_role` nuevo, con
  `import "server-only"` (importarlo desde el navegador es error de
  compilación, no un bug de runtime), `persistSession: false` y un contrato
  escrito de cuándo se permite usarlo.
- Regla explícita: la llave de servicio solo se usa **después** de
  `requirePermission()`.

**Archivos:** `src/lib/supabase/admin.ts`, `src/app/api/cotizaciones/route.ts`,
`supabase/migrations/0005_endurecimiento_rls.sql`

---

### #4 — ENABLE ROW-LEVEL SECURITY · **NEEDS ATTENTION** (corrección escrita, falta aplicar) · severidad **CRITICAL**

**Aplica**: Postgres soporta RLS y ya estaba activo en ambas tablas.

#### 🔴 Hallazgo 1 — `comparables` era legible por cualquiera en internet

```sql
create policy "comparables lectura publica"
  on comparables for select using (true);
```

`using (true)` significa "cualquiera, con o sin sesión". Combinado con que
la anon key es pública por diseño (va en el JavaScript que sirve la app),
**cualquier persona podía sacarla del navegador y descargar la tabla
completa** con un `curl` a la REST API de Supabase.

Lo que hay en esa tabla no es catálogo público: son **los montos reales de
patrocinios cerrados, con marca y evento** — Ultra/Sprite $5,000,000,
Goleiro/Michelob Ultra $1,000,000, Match Cup $300,000. Es precisamente la
información comercial que la plataforma existe para proteger.

**Severidad CRITICAL** por el tipo de dato expuesto y por no requerir
credencial alguna.

**Corrección** (`0005_endurecimiento_rls.sql`):
```sql
drop policy if exists "comparables lectura publica" on comparables;
create policy "comparables: solo con sesión iniciada"
  on comparables for select using (auth.uid() is not null);
```

#### 🔴 Hallazgo 2 — el navegador podía escribir cualquier precio

Ver #8, que es el mismo defecto visto desde el ángulo de field tampering.

#### Lo que sí estaba bien

`cotizaciones` tenía `select using (auth.uid() = user_id)`: aislamiento por
dueño correcto, y **sin políticas de UPDATE/DELETE**, que en RLS significa
denegado. Eso es deny-by-default bien hecho y no se tocó.

**Estado:** la migración está escrita y **no aplicada** — requiere un
proyecto de Supabase vivo (el actual da NXDOMAIN, ver `DECISIONS.md`).

**Archivos:** `supabase/migrations/0005_endurecimiento_rls.sql`

---

### #5 — ENCRYPT SENSITIVE DATA · **SECURE** · sin acción

Clasificación de lo que la plataforma guarda hoy:

| Dato | Sensibilidad | Tratamiento | ¿Correcto? |
|---|---|---|---|
| Contraseñas | Crítica | **No se almacenan.** Las gestiona Supabase Auth | ✅ |
| Email, nombre | Media (PII) | En claro, cifrado en reposo por Supabase (AES-256 a nivel disco) | ✅ |
| Montos de patrocinios | **Alta (comercial)** | En claro + RLS | ✅ tras #4 |
| Cotizaciones | Media | En claro + RLS por dueño | ✅ |
| Racional de IA | Baja | Texto plano | ✅ |

**No se cifró nada de más, a propósito.** Cifrado a nivel campo sobre los
montos rompería los índices, el ordenamiento y las agregaciones que el
producto necesita, a cambio de proteger contra un atacante que ya tendría
acceso al disco de Postgres — un modelo de amenaza que Supabase ya cubre con
cifrado en reposo. El control correcto para estos datos es RLS (#4), no
criptografía.

---

### #6 — ENFORCE SERVER-SIDE AUTHORIZATION · **FIXED** · severidad HIGH (era)

**Estado antes de esta sesión y la anterior:** ningún endpoint verificaba
autorización. `/api/narrativa` era completamente público.

**Ahora, en 5 capas** (solo las tres últimas son seguridad):

| Capa | Mecanismo | ¿Seguridad? |
|---|---|---|
| Navegación | `visibleNavigation()` filtra módulos | ❌ cortesía |
| Componente | `<Can permission="…">` | ❌ cortesía |
| Página | `getAuthzContext()` + `can()` | ✅ |
| Endpoint | `requirePermission()` | ✅ **la que cuenta** |
| Base de datos | RLS de Postgres | ✅ |

**Verificado con peticiones reales contra el build de producción:**
```
POST /api/narrativa    sin sesión → 401 {"error":"Inicia sesión para generar el racional."}
POST /api/cotizaciones sin sesión → 401 {"error":"Inicia sesión para guardar la cotización."}
```

**Fail-closed:** si Supabase está caído o inalcanzable, `getAuthzContext()`
devuelve `ANONYMOUS` (cero permisos). Nunca abre.

**Archivos:** `src/lib/auth/session.ts`, `src/app/api/*/route.ts`,
`src/app/cotizaciones/page.tsx`

---

### #7 — LOCK RECORD ACCESS (IDOR) · **SECURE** · severidad MEDIUM

No hay rutas por ID todavía (`/cotizaciones/[id]` no existe), así que no hay
IDOR explotable hoy. Lo relevante es que el patrón que se dejó **no lo
permite**:

- La lectura de `cotizaciones` va por RLS `auth.uid() = user_id`. Aunque
  alguien adivine un UUID ajeno, Postgres devuelve 0 renglones. **La
  autorización a nivel registro está en la base, no en el código de la
  aplicación** — que es donde no se puede olvidar.
- La escritura toma `user_id` de la sesión del servidor; el cuerpo de la
  petición no puede influir en él.
- `0004_rbac.sql` ya contempla `quotes.view_all` para la visibilidad de
  equipo, sin aflojar la política de "solo las mías" (las políticas
  permisivas se combinan con OR).

**Regla para cuando se agreguen rutas por ID:** autorizar sobre *recurso +
acción + registro*, nunca solo sobre los dos primeros. Está escrito en
`.claude/skills/aforo-authz/SKILL.md`.

---

### #8 — BLOCK FIELD TAMPERING · **FIXED** · severidad **CRITICAL**

#### 🔴 El hallazgo más grave de código de esta auditoría

`GuardarCotizacion.tsx` insertaba desde el **navegador**:

```ts
await supabase.from("cotizaciones").insert({
  user_id: userData.user.id,
  precio_min: resultado.min,          // ← del cliente
  precio_objetivo: resultado.objetivo, // ← del cliente
  precio_max: resultado.max,           // ← del cliente
  desglose: resultado.desglose,        // ← del cliente
  …
});
```

RLS (`with check (auth.uid() = user_id)`) impedía escribir en el renglón de
**otro** usuario. Pero no decía absolutamente nada sobre el **contenido**:
cualquiera con una sesión válida podía guardar una cotización de $9,000,000
con un `curl`, sin pasar por la fórmula.

**Por qué es crítico y no cosmético:** toda la propuesta de valor del
producto es *"el número es defendible porque salió de una fórmula
determinista y auditable, calibrada con deals reales"*. Si el precio guardado
puede ser cualquier cosa, lo guardado deja de ser evidencia de nada — y es un
registro comercial interno que se usa para defender precios frente a marcas.

**Corregido en tres frentes, porque uno solo no bastaba:**

1. **Endpoint nuevo** `POST /api/cotizaciones` que **recalcula el precio
   server-side** con `computePrice()` y descarta cualquier cifra del cliente.
   El cliente propone las variables; el servidor decide el precio.
2. **Allowlist explícita de campos** (`parseEventoInput`): se construye un
   objeto nuevo leyendo solo las 10 llaves permitidas. `user_id`,
   `created_by`, `role`, `isAdmin`, `precio_*` y `desglose` no tienen por
   dónde entrar — no se filtran, no se copian.
3. **Revocación en la base** (`0005`): sin esto los dos puntos anteriores
   serían cosméticos, porque el usuario podía seguir pegándole directo a la
   REST API de Supabase con su propia sesión.
   ```sql
   drop policy if exists "usuario crea sus propias cotizaciones" on cotizaciones;
   revoke insert, update, delete on cotizaciones from authenticated;
   ```

**Tests que lo fijan:**
- `los campos protegidos que manda el cliente se descartan`
- `el precio lo decide el servidor: el que mande el cliente es irrelevante`
- `el rol se toma del perfil del servidor, no de lo que mande el cliente`

**Archivos:** `src/app/api/cotizaciones/route.ts`,
`src/lib/validation/parseEvento.ts`, `src/components/GuardarCotizacion.tsx`,
`supabase/migrations/0005_endurecimiento_rls.sql`

---

### #9 — SECURE SESSION COOKIES · **FIXED (parcial)** · severidad HIGH (era)

Los defaults de `@supabase/ssr` (verificados en
`node_modules/@supabase/ssr/dist/main/utils/constants.js`):

```js
{ path: "/", sameSite: "lax", httpOnly: false, maxAge: 400 * 24 * 60 * 60 }
```

Dos de los cuatro no sirven para una herramienta interna:

| Atributo | Antes | Ahora | Razón |
|---|---|---|---|
| `secure` | **sin fijar** | `true` en producción | Sin esto, en cualquier despliegue que acepte HTTP la cookie de sesión viaja en claro |
| `maxAge` | **400 días** | **7 días** | Una sesión robada vivía más de un año. El refresh token renueva mientras el usuario esté activo, así que nadie lo nota |
| `sameSite` | `lax` | `lax` (sin cambio) | `strict` rompería el regreso del proveedor OAuth. `lax` ya bloquea el envío en peticiones cross-site que no son navegación |
| `httpOnly` | `false` | `false` (**sin cambio**) | Ver abajo |

**Por qué `httpOnly` sigue en `false` — y no lo marco como SECURE:**

Es una restricción del diseño de Supabase, no un descuido: `createBrowserClient`
lee la cookie con `document.cookie` para hidratar la sesión en el navegador.
Ponerlo en `true` rompe ese cliente.

**Consecuencia real:** cualquier XSS se convierte en robo de sesión completo.
La mitigación actual es que no hay superficie de XSS (#15) y que la CSP (#18)
lo dificulta — pero eso es defensa en profundidad, no una solución.

**Camino a `httpOnly: true`** (requiere tu aprobación, §6): mover el flujo a
sesión 100% server-side. Ya avanzó solo: tras el arreglo de #8, el cliente de
navegador ya no se usa para escribir, solo queda `signInWithOAuth` (que no
necesita sesión previa) y `signOut` (convertible a Server Action). **No lo
implementé porque no puedo probarlo sin un Supabase vivo, y romper el login
en silencio sería peor que el riesgo que corrige.**

**Invalidación:** `signOut()` de Supabase revoca el refresh token del lado
del servidor, no solo borra la cookie. Correcto. Además, tras `0004_rbac.sql`,
`resolveAuthzContext()` corta el acceso de una cuenta desactivada **en cada
petición**, sin esperar a que expire la cookie — con test que lo fija.

**Archivos:** `src/lib/supabase/cookieOptions.ts` (nuevo), `client.ts`,
`server.ts`, `src/proxy.ts`

---

### #10 — HASH PASSWORDS · **NOT APPLICABLE** (por delegación correcta)

La plataforma **no almacena contraseñas**. Supabase Auth las gestiona
(bcrypt del lado del servicio).

**Lo correcto aquí era no hacer nada**, y así se dejó: no hay tabla de
contraseñas, ni hash propio, ni almacenamiento duplicado. Implementar
Argon2id sería introducir el riesgo que este control busca evitar.

Cuando se active la invitación por correo (`RBAC-ARCHITECTURE.md` §6), la
contraseña la fija el usuario contra Supabase directamente: **el
administrador nunca la conoce y la aplicación nunca la ve.**

---

### #11 — RATE LIMIT LOGIN · **FIXED (con límite conocido)** · severidad HIGH (era)

**Estado antes:** ninguno. Ni en el callback de auth ni en el endpoint que
llama a la API de pago de Anthropic.

**Implementado** (`src/lib/rateLimit.ts`), ventana deslizante en memoria:

| Endpoint | Límite | Ventana | Clave |
|---|---|---|---|
| Pre-autenticación (todos los `/api`) | 60 | 60 s | IP |
| `POST /api/narrativa` | 10 | 60 s | usuario |
| `POST /api/cotizaciones` | 20 | 60 s | usuario |
| `GET /auth/callback` | 15 | 60 s | IP |

Decisiones deliberadas:

- **Límite pre-autenticación por IP.** Comprobar la sesión ya cuesta una
  llamada a Supabase; sin esto, un anónimo podía inundar ese camino sin
  credenciales. (Hueco que encontré al probar la primera versión, en la que
  el rate limit corría *después* de autenticar.)
- **Por usuario cuando hay sesión, no por IP.** Una oficina con NAT comparte
  IP: limitar por IP castigaría a todo el equipo por el bucle de una persona.
- **Sin bloqueo permanente.** La ventana expira sola y se devuelve
  `Retry-After`. Un bloqueo permanente convertiría el propio control en una
  vía de denegación de servicio contra usuarios legítimos — que es
  exactamente lo que pediste evitar.
- **Barrido del Map** con tope de 10,000 entradas: sin él, una clave distinta
  por petición sería una fuga de memoria y un vector de DoS.

**Límite honesto, no escondido:** en Vercel cada instancia serverless tiene
su propia memoria. El límite efectivo es *(límite × instancias activas)* y se
reinicia en cada arranque en frío. **Detiene el caso realista** (un bucle
desde un cliente quemando la cuota de Anthropic); **no detiene a un atacante
distribuido**. Migrar a Upstash Redis reemplaza el cuerpo de
`checkRateLimit()` y nada más — recomendación en §7.

**Tests:** corta al superar el límite · cada solicitante tiene presupuesto
propio · la ventana expira y el usuario se recupera.

---

### #12 — ADD BOT PROTECTION · **NEEDS ATTENTION** · severidad LOW

**Estado:** ninguna. Superficie hoy muy pequeña — el único punto de entrada
sin sesión es `/auth/callback`, que ya está limitado por IP (#11), y el login
es Google OAuth, que trae la protección antibot de Google.

**No agregué CAPTCHAs**, deliberadamente: no hay registro abierto, no hay
recuperación de contraseña propia y no hay formularios públicos. Poner un
CAPTCHA en una herramienta interna de ~10 personas es fricción sin beneficio.

**Cuándo reevaluar:** al activar invitaciones por correo, el endpoint de
aceptación de invitación sí es público y ahí sí conviene. Recomendación:
Vercel Bot Protection (transparente, sin fricción) antes que un CAPTCHA
visible.

---

### #13 — PARAMETERIZE QUERIES · **SECURE** · sin acción

**No hay ORM y no hay SQL construido en la aplicación.** Todo el acceso pasa
por `supabase-js`, que habla con PostgREST vía HTTP con parámetros
tipados — no hay concatenación de cadenas en la que inyectar.

**Verificado:** 0 coincidencias de `.rpc(`, `.sql`, `raw(`, `query(` o
concatenación de SQL en `src/`.

El único SQL del proyecto está en las migraciones, que son estáticas y no
reciben input de usuario. Las funciones `tiene_permiso()` y
`crear_perfil_para_usuario_nuevo()` de `0004` usan parámetros tipados y
`set search_path = public` (que es la mitigación correcta contra el secuestro
de `search_path` en funciones `security definer`).

**Test:** `parseEventoInput` rechaza `activacion: "'; drop table--"` — no
porque haya riesgo de inyección, sino porque el valor no está en el catálogo.

---

### #14 — VALIDATE ALL INPUT · **FIXED** · severidad HIGH (era)

**Estado antes:** `validateEvento()` existía y estaba bien testeado, pero
**solo corría en el navegador**. `/api/narrativa` hacía:

```ts
let body: NarrativaBody;      // ← tipo de TypeScript
body = await request.json();  // ← que no existe en runtime
const { evento, precio } = body;
if (!evento || !precio) { … } // ← única comprobación
```

El tipo de TypeScript daba una falsa sensación de validación: se borra al
compilar. Un cuerpo con `aforo: [1,2]`, `lineup: {$ne:null}` o
`activacion: null` pasaba.

**Corregido** con `src/lib/validation/parseEvento.ts`, que es la única puerta
por la que un evento entra al servidor:

1. Rechaza lo que no sea objeto plano (arreglos y `null` incluidos).
2. Normaliza tipos: `"15000"` → `15000`; `Number()` a secas acepta `""`,
   `null` y `true`, aquí no.
3. Valida enums contra el catálogo real.
4. **Reutiliza `validateEvento()`** para las reglas de negocio (topes de
   aforo, días, territorio) — un solo lugar, ya testeado.
5. Aplica la allowlist de campos (#8).

Aplicado en `/api/narrativa` y `/api/cotizaciones`, que devuelven **422** con
el detalle por campo.

**Frontend + backend, ambos:** el formulario sigue validando para la UX; el
servidor valida para la seguridad.

**Tests:** 6 pruebas cubriendo basura, enums inválidos, rangos, texto
numérico y longitudes abusivas.

---

### #15 — ESCAPE USER CONTENT · **SECURE** · severidad LOW

**Verificado:** 0 coincidencias de `dangerouslySetInnerHTML`, `innerHTML`,
`eval(`, `new Function` o `document.write` en todo `src/`.

React escapa por defecto todo lo que se interpola en JSX. Los campos que
vienen del usuario (`nombre_evento`) y del LLM (`racional`) se renderizan
como texto:

```tsx
<TD className="font-medium">{c.nombre_evento}</TD>
<p className="text-sm leading-relaxed text-fg">{state.narrativa}</p>
```

**El racional merece mención aparte:** es texto generado por un LLM a partir
de datos que el usuario controla. Es un vector clásico de inyección indirecta.
Aquí es seguro porque (a) se renderiza como texto plano, (b) se acota a 4,000
caracteres al guardarlo, y (c) el LLM **no decide el precio** — solo lo
explica; el número sale de `computePrice()` del lado del servidor.

**Test:** un `nombre_evento` con `<img src=x onerror=alert(1)>` se conserva
como cadena y nunca como HTML.

**Cuando llegue rich text o contenido importado**, este control cambia de
estado y hará falta sanitización explícita (DOMPurify o equivalente).

---

### #16 — RESTRICT FILE UPLOADS · **NOT APPLICABLE**

La plataforma no sube ni sirve archivos de usuario. No se usa Supabase
Storage. `public/` solo tiene SVGs estáticos del repositorio.

**Criterios ya escritos para cuando aplique** (no implementados, a propósito
—no se construye seguridad para una funcionalidad que no existe—): validar
MIME real por contenido y no por extensión, tope de tamaño, nombre generado
por el servidor y nunca el del cliente, bucket privado con URLs firmadas de
vida corta, y jamás servir desde un dominio que comparta cookies con la app.

---

### #17 — TRIM API RESPONSES · **FIXED** · severidad MEDIUM

**Corregido:** `/api/narrativa` hacía `.select("*")` sobre `comparables`. Con
`*`, cualquier columna que se agregue después (una nota interna, un contacto,
un margen) empieza a salir por la API sin que nadie lo decida. Ahora la lista
de columnas es explícita.

**Ya estaba bien:** la página de cotizaciones selecciona 8 columnas
explícitas; `POST /api/cotizaciones` devuelve solo `{ id, precio }`.

**El `AuthzContext` que baja al cliente** lleva `userId`, `email`,
`displayName`, `role` y `permissions` — todos necesarios para pintar la UI, y
ninguno es secreto: el usuario ya conoce su propia identidad y sus permisos.
No incluye hashes, tokens ni metadatos internos de autenticación.

**Errores:** ningún mensaje crudo de Postgres o Supabase llega al cliente.
Van a `console.error` y el usuario recibe un mensaje de producto. (Los
mensajes de Postgres revelan nombres de tabla, columnas y políticas.)

---

### #18 — ADD SECURITY HEADERS · **FIXED** · severidad HIGH (era)

**Estado antes: ninguna cabecera de seguridad.** La única no estándar era
`X-Powered-By: Next.js`.

**Verificado con `curl` contra el build de producción real:**

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self';
  connect-src 'self' https://<proyecto>.supabase.co wss://<proyecto>.supabase.co;
  object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
  frame-src 'none'; manifest-src 'self'; worker-src 'self' blob:;
  upgrade-insecure-requests
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: accelerometer=(), camera=(), geolocation=(), microphone=(), … (14 directivas)
X-Frame-Options: DENY
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Powered-By: (eliminado)
```

Y en `/api/*`: `Cache-Control: no-store` + `X-Robots-Tag: noindex`.

**La CSP se construyó sobre el inventario real de recursos**, no copiada:
- `connect-src` toma el origen de Supabase de `NEXT_PUBLIC_SUPABASE_URL` en
  tiempo de build, así que dev/preview/producción declaran cada uno el suyo.
- `font-src 'self'` porque `next/font` auto-hospeda Inter (no pega a Google).
- `'unsafe-eval'` **solo en desarrollo** (React Refresh lo necesita).

**Verificado que no rompe la app** — Chromium real contra el build de
producción, con interacción completa (llenar formulario + calcular):

```
Resultado calculado visible : true
Fuente Inter aplicada       : true
Violaciones de CSP          : 0
Peticiones fallidas         : 0
```

**Limitación que no escondo:** `script-src` incluye `'unsafe-inline'`, que
debilita bastante la protección de la CSP contra XSS. Lo exigen los scripts
de arranque e hidratación que Next inyecta. La alternativa —CSP con nonce—
obliga a renderizado dinámico en **todas** las rutas. Dado que hoy no hay
superficie de XSS (#15), la relación costo/beneficio no lo justifica todavía.
Recomendación en §7.

**Archivos:** `next.config.ts`

---

### #19 — FORCE HTTPS · **SECURE** · severidad LOW

- **Vercel** termina TLS y redirige HTTP→HTTPS automáticamente en todos los
  dominios, incluidos los de preview. No hay que configurar redirects.
- **HSTS agregado**: `max-age=63072000; includeSubDomains`, **solo en
  producción** (en desarrollo rompería `http://localhost`).
- **`preload` NO incluido, a propósito.** Entrar a la lista de precarga de
  los navegadores es prácticamente irreversible y afectaría a todos los
  subdominios del dominio, incluidos los que no existen todavía. Debe ser una
  decisión explícita tuya, no un efecto secundario de esta auditoría.
- **`upgrade-insecure-requests`** en la CSP como red de seguridad.
- **Cookies con `secure: true`** en producción (#9).

---

### #20 — SCAN DEPENDENCIES · **SECURE** · sin acción urgente

```
npm audit → { critical: 0, high: 0, moderate: 0, low: 0, info: 0 }
```

**9 dependencias directas · 390 paquetes en total.** Un árbol muy contenido
para un proyecto Next.js — eso en sí es una virtud de seguridad.

| Paquete | Versión | Estado |
|---|---|---|
| `next` | 16.3.1 | Al día |
| `react` / `react-dom` | 19.2.8 | Al día |
| `@supabase/supabase-js` | 2.112.3 | Al día |
| `@supabase/ssr` | 0.12.4 | Al día (ver #9 sobre sus defaults) |
| `@anthropic-ai/sdk` | 0.119.0 | Al día |
| `server-only` | 0.0.1 | Estable — es un stub de 3 líneas de Vercel, la versión es correcta |

**Ninguna dependencia abandonada, obsoleta ni innecesaria.** No se agregó
ninguna en esta fase de hardening: rate limiting, validación y allowlist se
implementaron con código propio en vez de sumar `express-rate-limit` y `zod`.
Menos superficie que auditar.

**No actualicé nada automáticamente.** No hay actualizaciones mayores
pendientes ni breaking changes que evaluar.

**Recomendación:** activar Dependabot en GitHub (§7). Es un archivo y da
alertas continuas en vez de un escaneo puntual.

---

## 2. Tabla resumen

| # | CONTROL | STATUS | RISK | ACTION |
|---|---|---|---|---|
| 1 | Hide API keys | **FIXED** | HIGH | Verificado que no hay fuga al bundle; corregido mensaje que revelaba nombre de variable |
| 2 | Purge git secrets | **SECURE** | — | 151 blobs escaneados, 0 secretos. Rotar `ANTHROPIC_API_KEY` por motivo externo (§5) |
| 3 | Public DB keys | **FIXED** | HIGH | Cliente `service_role` server-only con contrato de uso |
| 4 | Row-Level Security | **NEEDS ATTENTION** | **CRITICAL** | `0005` escrita — **falta aplicarla en Supabase** |
| 5 | Encrypt sensitive data | **SECURE** | — | Clasificado; RLS es el control correcto aquí, no cifrado |
| 6 | Server-side authz | **FIXED** | HIGH | `requirePermission()` en todos los endpoints; 401/403 verificados |
| 7 | Lock record access | **SECURE** | MEDIUM | RLS por dueño; patrón documentado para rutas por ID |
| 8 | Block field tampering | **FIXED** | **CRITICAL** | Precio recalculado server-side + allowlist + revocación en BD |
| 9 | Secure session cookies | **FIXED (parcial)** | HIGH | `secure` + 7 días. `httpOnly` requiere tu aprobación (§6) |
| 10 | Hash passwords | **NOT APPLICABLE** | — | Delegado a Supabase Auth; no duplicar |
| 11 | Rate limit | **FIXED** | HIGH | 4 presupuestos + límite pre-auth. Migrar a Redis para escala (§7) |
| 12 | Bot protection | **NEEDS ATTENTION** | LOW | Innecesario hoy; reevaluar al activar invitaciones |
| 13 | Parameterize queries | **SECURE** | — | Sin ORM ni SQL en la app; PostgREST tipado |
| 14 | Validate all input | **FIXED** | HIGH | `parseEventoInput()` server-side en ambos endpoints |
| 15 | Escape user content | **SECURE** | LOW | 0 usos de HTML crudo; React escapa |
| 16 | Restrict file uploads | **NOT APPLICABLE** | — | No hay subida de archivos |
| 17 | Trim API responses | **FIXED** | MEDIUM | `select("*")` eliminado; errores de BD no llegan al cliente |
| 18 | Security headers | **FIXED** | HIGH | CSP + 8 cabeceras, verificadas y probadas sin romper la app |
| 19 | Force HTTPS | **SECURE** | LOW | Vercel + HSTS (sin `preload`, a propósito) |
| 20 | Scan dependencies | **SECURE** | — | 0 vulnerabilidades. Activar Dependabot (§7) |

**FIXED 9 · SECURE 7 · NEEDS ATTENTION 2 · NOT APPLICABLE 2**

---

## 3. Tests de seguridad automatizados

`src/lib/security.test.ts` — **23 pruebas nuevas**, 63 en total en el proyecto.

| Escenario pedido | Test |
|---|---|
| ✓ usuario autorizado accede | `un usuario autorizado sí pasa` |
| ✗ no autorizado recibe 403 | `un usuario sin el permiso recibe 403, no 200` |
| ✗ anónimo | `un anónimo recibe 401 antes que 403` |
| ✗ escala su propio rol | `el rol se toma del perfil del servidor, no de lo que mande el cliente` |
| ✗ campos protegidos en el request | `los campos protegidos que manda el cliente se descartan` |
| ✗ precio manipulado | `el precio lo decide el servidor: el que mande el cliente es irrelevante` |
| ✗ endpoint oculto en frontend | `esconder el módulo en la navegación no concede ni niega acceso por sí solo` |
| ✗ usuario desactivado con sesión viva | `una cuenta desactivada pierde todos sus permisos aunque la sesión siga viva` |
| Deny by default | `un usuario sin rol asignado no recibe ningún acceso implícito` |
| Ruta nueva sin policy | `toda ruta /admin declara permisos: ninguna queda pública por olvido` |

Los seis roles quedan cubiertos, y —como pediste— **las aserciones son sobre
permisos, no sobre nombres de rol**: `hasRole()` solo se prueba para
confirmar que no concede accesos.

---

## 4. Principio de mínimo privilegio — cómo queda garantizado

| Regla | Dónde se impone |
|---|---|
| Usuario nuevo sin rol ⇒ cero permisos | `resolveAuthzContext()` devuelve `ANONYMOUS` · con test |
| Cuenta no ACTIVE ⇒ cero permisos, en cada petición | `resolveAuthzContext()` · con test |
| Supabase caído ⇒ anónimo, no "déjalo pasar" | `getAuthzContext()` fail-closed |
| Ruta `/admin` sin permisos declarados ⇒ falla el test | `toda ruta /admin declara permisos…` |
| Rol que otorga un permiso inexistente ⇒ falla el test | `ningún rol concede un permiso fuera del catálogo` |
| Tabla sin política ⇒ RLS niega | Comportamiento de Postgres + `revoke` explícitos en `0005` |
| Campo no declarado en la allowlist ⇒ se descarta | `parseEventoInput()` construye objeto nuevo · con test |

---

## 5. Secretos que necesitan rotación

| Secreto | ¿Expuesto en el repo? | ¿Rotar? | Por qué |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **No** | **Sí, recomendado** | Motivo externo al repo: `DECISIONS.md` documenta que se pegó a mano en la consola de Vercel varias veces y que **es la misma llave compartida con el proyecto Cotejo**. Una llave por proyecto permite medir el costo por separado y revocar una sin tumbar la otra |
| `SUPABASE_SERVICE_ROLE_KEY` | No | **Sí, al recrear el proyecto** | El proyecto anterior da NXDOMAIN. Si se crea uno nuevo la llave es nueva por definición; si el viejo se reactiva, conviene rotarla por higiene tras semanas inactivo |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | No | Es pública por diseño. Solo rotar si se rota el proyecto |
| `AFORO_SUPER_ADMIN_EMAILS` | No | N/A | No es una credencial; es una lista de correos |

**Ninguna rotación es urgente por fuga en el repositorio.** El escaneo salió
limpio.

---

## 6. Cambios que necesitan tu aprobación

### A) Aplicar `0005_endurecimiento_rls.sql` — 🔴 el más importante

Cierra los dos hallazgos CRITICAL (#4 y #8). **Sin esto, el arreglo de código
de #8 es parcial**: el usuario puede saltarse el endpoint y escribir directo
en la REST API de Supabase.

**Requisito previo:** `SUPABASE_SERVICE_ROLE_KEY` configurada en Vercel
**antes** de aplicarla, o el guardado de cotizaciones dejará de funcionar.

**No puedo aplicarla yo:** no tengo acceso al proyecto de Supabase, y además
el proyecto actual no resuelve por DNS.

### B) `httpOnly: true` en la cookie de sesión

**OPCIÓN A — dejarlo como está (`httpOnly: false`).**
A favor: es el diseño de Supabase, cero riesgo de romper el login.
En contra: cualquier XSS roba la sesión completa.

**OPCIÓN B — sesión 100% server-side y `httpOnly: true`.**
A favor: elimina el robo de sesión por XSS, que es el escenario más grave.
En contra: hay que convertir `signOut` en Server Action y verificar que
`signInWithOAuth` sigue funcionando. **No es probable que rompa, pero no
puedo demostrarlo sin un Supabase vivo.**

**RECOMENDACIÓN: Opción B, pero después de que haya un proyecto de Supabase
funcionando y podamos probar el login de punta a punta.**

**POR QUÉ:** el trabajo pesado ya está hecho —tras el arreglo de #8 el
cliente de navegador ya casi no se usa—, así que el cambio es pequeño. Lo que
falta no es esfuerzo, es **poder verificarlo**. Aplicar a ciegas un cambio en
el camino de autenticación es exactamente el tipo de riesgo que una auditoría
de seguridad debería evitar, no crear.

### C) HSTS `preload` — recomiendo **no** hacerlo por ahora

Es prácticamente irreversible y afecta a todos los subdominios presentes y
futuros. `max-age` sin `preload` da casi todo el beneficio sin la trampa.

---

## 7. Recomendaciones futuras

**Corto plazo**
1. **Dependabot** (`.github/dependabot.yml`) — alertas continuas en vez de un
   escaneo puntual.
2. **`bloqueo de secretos` en CI** — un job que corra el mismo escaneo de
   patrones sobre cada PR. Barato y evita el error humano de un `.env`
   pegado en un commit.
3. **Rotar `ANTHROPIC_API_KEY`** y usar una llave por proyecto (§5).

**Mediano plazo**
4. **Rate limiting distribuido** (Upstash Redis) — solo hay que reemplazar el
   cuerpo de `checkRateLimit()`; las llamadas no cambian.
5. **Audit log** — `RBAC-ARCHITECTURE.md` §8 ya lo dejó desbloqueado:
   `requirePermission()` devuelve el actor, y es el único punto por el que
   pasan todas las escrituras sensibles.
6. **CSP con nonce** cuando se introduzca contenido rico o de terceros.
   Mientras no haya superficie de XSS, `'unsafe-inline'` es un costo
   aceptable frente a volver toda la app dinámica.

**Al crecer**
7. **Vercel Bot Protection** al abrir el endpoint de aceptación de invitación.
8. **Detección de sesiones comprometidas** — registrar `ultimo_acceso` (la
   columna ya existe en `0004`) y alertar ante saltos geográficos.
9. **Revisión de RLS en CI** — las dos consultas de verificación que dejé al
   final de `0005` (ninguna tabla sin RLS, ninguna política con `qual = true`)
   se pueden correr automáticamente contra un Supabase de prueba.
