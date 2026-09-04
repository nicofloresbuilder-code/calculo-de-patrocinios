# RBAC-ARCHITECTURE — Usuarios, roles y permisos en Aforo

Propuesta de arquitectura para las FASES 4–6, adaptada al stack **que ya
existe** (Next.js 16 App Router + Supabase Postgres + Supabase Auth).

**Estado:** la capa de aplicación ya está construida y probada (40 tests
verdes). La capa de base de datos está **escrita pero no aplicada** — espera
una decisión de producto (§6) y un proyecto de Supabase vivo.

---

## 1. Punto de partida real

| | Antes | Ahora |
|---|---|---|
| Autenticación | Supabase Auth, solo Google OAuth | igual (sin cambios) |
| Perfil de usuario | ninguno — solo `auth.users` | ninguno todavía (§3) |
| Autorización | solo RLS "cada quien ve lo suyo" | catálogo de permisos + DAL + guards |
| Dónde se preguntaba "¿quién eres?" | 4 archivos distintos | 1 (`getAuthzContext()`) |
| Endpoint `/api/narrativa` | **público** | exige `quotes.create` |

`auth.users` es una tabla del esquema de Supabase: **no se le pueden agregar
columnas propias**. Por eso hace falta una tabla de perfiles espejo, que es
el patrón estándar de Supabase.

---

## 2. Modelo conceptual

```
auth.users (Supabase)
     │ 1:1
     ▼
  perfiles ─────── nombre, apellido, status, creado_por, ultimo_acceso
     │ N:M (usuario_roles)
     ▼
   roles ───────── N:M (rol_permisos) ─────── permisos
```

Cuatro tablas + dos de unión. Se eligió **N:M entre usuario y rol** en vez de
una columna `role` porque el costo hoy es una tabla más y evita una migración
dolorosa el día que alguien tenga que ser MANAGER y OPERATIONS a la vez.

### Por qué no `role = 'admin'`

Porque la lógica de la app **nunca pregunta por el nombre de un rol**.
Pregunta por un permiso:

```ts
can(ctx, "users.create")     // ✅ así
hasRole(ctx, "ADMIN")        // ❌ nunca para decidir accesos
```

Mover un permiso de un rol a otro, o crear un rol nuevo, es un `UPDATE` — no
toca ni una línea de UI ni de endpoints.

---

## 3. Lo que ya está construido (y probado)

| Archivo | Qué es |
|---|---|
| `src/lib/auth/permissions.ts` | Catálogo tipado de permisos (`recurso.acción`), roles, estados de cuenta y el mapa rol→permisos. **Seed del futuro `rol_permisos`.** |
| `src/lib/auth/can.ts` | `AuthzContext` + `can` / `canAny` / `canAll` / `hasRole`. Funciones puras: misma respuesta en servidor y cliente. |
| `src/lib/auth/session.ts` | **DAL.** `getAuthzContext()` (memoizada con `React.cache`), `requireAuth()`, `requirePermission()`. Marcada `server-only`: importarla desde el cliente es error de compilación. |
| `src/lib/navigation.ts` | Registro de módulos con sus permisos. La barra lateral sale de aquí. |
| `src/components/auth/AuthzProvider.tsx` | Baja el contexto del servidor al cliente. `usePermissions()`. |
| `src/components/auth/Can.tsx` | `<Can permission="…">`. |
| `src/lib/authz.test.ts` | 12 tests: SUPER_ADMIN tiene todo, anónimo no tiene nada, VIEWER es de solo lectura, la navegación esconde Administración, ningún rol otorga un permiso fuera del catálogo. |

### Permisos del catálogo

```
quotes.view · quotes.create · quotes.edit · quotes.delete · quotes.view_all
users.view · users.create · users.edit · users.delete · users.assign_role
comparables.view · comparables.create · comparables.edit · comparables.delete
reports.view · reports.export
settings.view · settings.edit
```

### Roles iniciales

`SUPER_ADMIN` · `ADMIN` · `MANAGER` · `COMMERCIAL` · `OPERATIONS` · `VIEWER`

### Qué hace hoy `getAuthzContext()`, sin la base de datos

- Sin sesión → `ANONYMOUS` (cero permisos).
- Con sesión → rol `COMMERCIAL`, que concede **exactamente lo que la app ya
  hacía antes de este cambio**: cotizar y guardar cotizaciones propias. No
  abre nada nuevo.
- Correo en `AFORO_SUPER_ADMIN_EMAILS` (variable **solo de servidor**, sin
  `NEXT_PUBLIC_`) → `SUPER_ADMIN`. Es el bootstrap para el problema del huevo
  y la gallina: crear al primer administrador antes de que exista la tabla de
  usuarios. Se puede vaciar en cuanto la migración esté aplicada.
- Supabase caído o inalcanzable → `ANONYMOUS`. **Falla cerrado, nunca abierto.**

Como ningún rol alcanzable concede `users.*` sin la migración, el módulo de
Administración es inaccesible hoy — ni por la barra lateral ni por URL.

---

## 4. Defensa en profundidad

| Capa | Archivo | Qué hace | Es seguridad? |
|---|---|---|---|
| 1. Navegación | `navigation.ts` | Esconde módulos sin permiso | ❌ cortesía |
| 2. Componentes | `<Can>` | Esconde botones sin permiso | ❌ cortesía |
| 3. Página | `getAuthzContext()` + `can()` | Bloquea la ruta | ✅ |
| 4. Endpoint / acción | `requirePermission()` | Bloquea la operación | ✅ **la que cuenta** |
| 5. Base de datos | RLS de Postgres | Última línea | ✅ |

> Las capas 1 y 2 existen para que la interfaz no ofrezca lo que el usuario
> no puede hacer. **Un usuario sin `users.delete` no puede borrar aunque
> llame el endpoint directamente**, porque la capa 4 lo rechaza sin
> consultar a la interfaz.

Ya aplicado: `POST /api/narrativa` exige `quotes.create` y devuelve 401/403.
Antes era público — cualquiera con la URL gastaba la cuota de la API de
Anthropic del proyecto.

---

## 5. Migración propuesta (escrita, sin aplicar)

`supabase/migrations/0004_rbac.sql`. Puntos de diseño:

1. **`perfiles` con `id` = `auth.users.id`** (1:1, `on delete cascade`).
2. **Trigger `on_auth_user_created`** que inserta el perfil automáticamente al
   registrarse — si no, un usuario nuevo queda sin perfil y sin permisos.
3. **Sin borrado duro.** `status` (`ACTIVE` / `INACTIVE` / `INVITED` /
   `SUSPENDED`) es el mecanismo de baja. Se conserva el historial y las
   cotizaciones no quedan huérfanas.
4. **`permisos` con `recurso` + `accion`** y un `unique` sobre el par, para
   que el catálogo relacional coincida con `permissions.ts`.
5. **Función `tiene_permiso(uuid, text)` en SQL `security definer`**, para que
   las políticas RLS puedan expresar permisos sin duplicar la lógica.
6. **`creado_por`, `creado_en`, `actualizado_en`** desde el día uno: son las
   columnas que el audit log va a necesitar.
7. **RLS en todas las tablas nuevas**, con lectura del propio perfil siempre
   permitida y administración condicionada a `users.*`.
8. **`quotes.view_all`** ya contemplado: la policy de `cotizaciones` deja ver
   las del equipo a quien lo tenga, sin cambiar la de "solo las mías".

Cuando se aplique, **el único código que cambia es el cuerpo de
`getAuthzContext()`**: leer `perfiles` + `usuario_roles`, devolver
`ANONYMOUS` si `status !== 'ACTIVE'`. Ni una llamada cambia.

---

## 6. Decisión pendiente — provider de autenticación

Esta es la decisión difícil de revertir. **No se implementó nada de esto**;
está a la espera de tu decisión.

### El problema

Hoy el único método de acceso es **Google OAuth, y está roto en producción**
(`redirect_uri_mismatch`, documentado en `DECISIONS.md` desde hace semanas).
La FASE 4 pide además un flujo de invitación: *crear usuario → invitar →
el usuario establece su contraseña → cuenta activa*, para que un
administrador nunca conozca la contraseña de nadie.

### OPCIÓN A — Seguir con Supabase Auth y activar invitaciones por correo

Se añade el provider de email a Supabase (ya está incluido) y se usa
`supabase.auth.admin.inviteUserByEmail()` desde una Route Handler con la
`SUPABASE_SERVICE_ROLE_KEY` (que ya existe en `.env.example` y nunca sale del
servidor). El usuario recibe un enlace, fija su contraseña y queda `ACTIVE`.
Google OAuth se conserva como segundo método.

- **A favor:** cero dependencias nuevas; el hasheo de contraseñas, los tokens
  de un solo uso, la expiración y el envío de correo los resuelve Supabase;
  `auth.uid()` sigue funcionando, así que **todas las policies de RLS actuales
  siguen válidas sin tocarlas**; desbloquea el guardado de cotizaciones sin
  depender de arreglar Google Cloud.
- **En contra:** hay que configurar SMTP (el remitente por defecto de Supabase
  tiene límites duros y no sirve para producción); queda un proveedor más que
  administrar.

### OPCIÓN B — Migrar a un proveedor externo (Auth.js / Clerk / Auth0)

- **A favor:** más proveedores sociales, SSO empresarial, UI de gestión lista.
- **En contra:** **rompe `auth.uid()`**, que es la base de toda la RLS que ya
  existe y está verificada. Habría que reescribir las policies, migrar
  identidades y mantener dos sistemas durante la transición. Clerk y Auth0
  además cuestan cuando crece el número de usuarios; hoy el proyecto corre en
  free tier de punta a punta.

### RECOMENDACIÓN — **Opción A**

### POR QUÉ

1. **El problema real no es el proveedor, es un redirect URI mal configurado
   en Google Cloud.** Cambiar de proveedor para no depurar una URL es cambiar
   la arquitectura por una causa que no lo justifica.
2. **La RLS existente es el activo más valioso que hay que no romper.** Está
   escrita, aplicada y verificada con `curl` contra la REST API. Todo depende
   de `auth.uid()`; la opción B lo invalida completo.
3. **La invitación por correo ya viene incluida** en lo que el proyecto usa.
   No es una funcionalidad que haya que construir, es una que hay que activar.
4. **Es reversible.** Si algún día hace falta SSO empresarial, Supabase Auth
   soporta SAML, y migrar entonces será una decisión con datos reales de uso
   en vez de una apuesta hoy.

**Lo único que necesito de ti para avanzar:** confirmar la Opción A y decidir
el remitente de correo (Resend, SendGrid, el SMTP de la empresa). Con eso, la
FASE 4 completa —invitaciones incluidas— es implementable de una sentada.

---

## 7. Archivos que tocará la FASE 6 (panel de administración)

| Archivo | Estado | Qué falta |
|---|---|---|
| `supabase/migrations/0004_rbac.sql` | ✍️ escrito | aplicar en Supabase |
| `src/lib/auth/session.ts` | ✅ construido | cambiar el cuerpo de `getAuthzContext()` para leer `perfiles` |
| `src/app/admin/layout.tsx` | ❌ | guard de segmento con `requirePermission("users.view")` |
| `src/app/admin/usuarios/page.tsx` | ❌ | tabla: nombre, email, rol, estado, último acceso, creado, acciones |
| `src/app/admin/usuarios/acciones.ts` | ❌ | Server Actions: crear, invitar, editar, cambiar rol, desactivar/reactivar — **cada una con `requirePermission()`** |
| `src/components/admin/UsuariosTable.tsx` | ❌ | búsqueda, filtros por estado y rol, orden |
| `src/components/ui/Dialog.tsx` | ❌ | falta la primitiva (crear/editar usuario, confirmar desactivación) |
| `src/components/ui/Dropdown.tsx` | ❌ | falta la primitiva (menú de acciones por fila) |
| `src/components/ui/Toast.tsx` | ❌ | falta la primitiva (confirmación de operaciones) |
| `src/lib/navigation.ts` | ✅ construido | ya declara `/admin/usuarios` con `users.view` |

---

## 8. Audit log — preparado, no construido

El diseño no lo bloquea:

- `perfiles` lleva `creado_por`, `creado_en`, `actualizado_en`.
- Toda operación sensible pasa por `requirePermission()`, que **ya devuelve el
  `AuthzContext` del actor** — el "quién" del log está disponible en el único
  punto por el que pasan todas las escrituras.

Cuando toque, es una tabla `bitacora` (`actor_id`, `accion`, `recurso`,
`recurso_id`, `antes` jsonb, `despues` jsonb, `creado_en`) y una llamada
después de cada acción. Sin cambio estructural.

---

## 9. Seguridad — estado actual

| Punto | Estado |
|---|---|
| Hasheo de contraseñas | Delegado a Supabase Auth (bcrypt). Nunca implementarlo a mano. |
| Sesión | Cookies httpOnly de `@supabase/ssr`, refrescadas en `src/proxy.ts` |
| CSRF | Supabase usa Bearer desde cookie httpOnly + PKCE en OAuth. Las Server Actions de Next traen protección de origen integrada. |
| Autorización server-side | ✅ `requirePermission()`; aplicado ya en `/api/narrativa` |
| Validación de entrada | ✅ `validateEvento()`, función pura y testeada |
| Secretos | ✅ `SUPABASE_SERVICE_ROLE_KEY` y `ANTHROPIC_API_KEY` solo servidor; `AFORO_SUPER_ADMIN_EMAILS` **sin** `NEXT_PUBLIC_` |
| Fuga de errores | ✅ corregido: los errores crudos de Supabase van a `console.error`, al usuario le llega un mensaje de producto |
| Rate limiting | ❌ **pendiente** — `/api/narrativa` ya exige sesión, pero un usuario válido puede llamarlo en bucle |
| Fail-closed | ✅ Supabase inalcanzable ⇒ `ANONYMOUS` |
