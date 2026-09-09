# SETUP — Poner Supabase en marcha

Guía operativa. Todo lo demás del proyecto está bloqueado detrás de esto:
sin un proyecto de Supabase vivo no se guarda ninguna cotización, no hay
login, la IA genera el racional sin comparables históricos, y los dos
hallazgos CRITICAL de `SECURITY-AUDIT.md` siguen abiertos.

**Tiempo estimado:** 20–30 minutos.

---

## Paso 0 — Averiguar en qué escenario estás

Entra a [supabase.com/dashboard](https://supabase.com/dashboard) y busca el
proyecto de Aforo.

| Lo que ves | Escenario | Sigue en |
|---|---|---|
| El proyecto aparece, dice **Paused** | **A — reactivar** | Paso 1A |
| El proyecto no aparece por ningún lado | **B — crear nuevo** | Paso 1B |

> El diagnóstico técnico apunta a que fue **borrado**, no pausado: el
> subdominio `ietahcthuejmgjlmgsub.supabase.co` da NXDOMAIN, y un proyecto
> pausado normalmente conserva su subdominio y responde con error. Pero eso
> solo se confirma entrando al dashboard, que es tuyo.

---

## Paso 1A — Reactivar el proyecto existente

1. Abre el proyecto → botón **Restore** / **Resume**.
2. Espera a que el estado pase a *Active* (unos minutos).
3. Ve al **Paso 2**.

Si al restaurarlo la base ya trae las tablas `comparables` y `cotizaciones`,
**no corras** `setup-proyecto-nuevo.sql`: solo te faltan las migraciones
`0002` en adelante.

## Paso 1B — Crear un proyecto nuevo

1. **New project**.
2. Región: **East US** o **West US** — son las más cercanas a México con
   free tier; no hay región en México.
3. Guarda la contraseña de la base en tu gestor de contraseñas. **No la
   pegues en el repo, ni en un chat, ni en un documento compartido.**
4. Espera a que termine de aprovisionar.

---

## Paso 2 — Copiar las tres llaves

En el proyecto: **Project Settings → API**.

| En Supabase se llama | Variable en el proyecto | Clase |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | **Pública** — va en el navegador |
| `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Pública** — va en el navegador |
| `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` | 🔴 **SECRETA — ignora RLS** |

> ⚠️ La `service_role` se salta **toda** la seguridad de la base. Nunca la
> pongas en una variable que empiece con `NEXT_PUBLIC_`, nunca la pegues en
> el código, y nunca la mandes por chat o correo. Si alguna vez se expone,
> hay que **rotarla**, no solo borrarla de donde apareció.

---

## Paso 3 — Configurar Vercel (ANTES de las migraciones)

**Este paso va antes del 4 a propósito.** La migración `0005` revoca la
escritura directa desde el navegador; si la aplicas sin la `service_role`
puesta en Vercel, guardar cotizaciones deja de funcionar.

En Vercel: **tu proyecto → Settings → Environment Variables**. Agrega las
cuatro, marcando **Production**, **Preview** y **Development** en cada una:

```
NEXT_PUBLIC_SUPABASE_URL       = https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = <anon key>
SUPABASE_SERVICE_ROLE_KEY      = <service_role key>
AFORO_SUPER_ADMIN_EMAILS       = tu-correo@ejemplo.mx
```

`AFORO_SUPER_ADMIN_EMAILS` es lo que te da el primer rol de administrador
antes de que exista la tabla de usuarios (el problema del huevo y la
gallina). Se puede vaciar en cuanto `0004` esté aplicada y te asignes el rol
en la base.

**Haz redeploy** después de agregarlas: Vercel no las aplica a un deploy ya
construido.

> Nota de `DECISIONS.md`: ya pasó una vez que una variable quedó guardada con
> **valor vacío** y el error resultante parecía otra cosa. Como las variables
> tipo *Secret* no se pueden leer de vuelta, si algo falla de forma rara,
> bórrala y vuelve a crearla en vez de asumir que está bien.

Lo mismo en tu máquina, en `.env.local` (que está en `.gitignore` y **nunca**
se commitea):

```bash
cp .env.example .env.local   # y llenar los valores
```

---

## Paso 4 — Correr las migraciones, en orden

**Supabase → SQL Editor → New query.** Pega el contenido de cada archivo y
ejecútalo. **Uno a la vez, en este orden, verificando que cada uno termine
sin error antes del siguiente.**

### Si creaste un proyecto NUEVO (escenario B)

| # | Archivo | Qué hace |
|---|---|---|
| 1 | `supabase/setup-proyecto-nuevo.sql` | Tablas base + RLS inicial + comparables con los montos ya corregidos |
| 2 | `supabase/migrations/0004_rbac.sql` | Perfiles, roles, permisos, trigger de alta |
| 3 | `supabase/migrations/0005_endurecimiento_rls.sql` | 🔴 **Cierra los dos hallazgos CRITICAL** |
| 4 | `supabase/migrations/0006_marca_contacto.sql` | Campos de marca y contacto + índices de búsqueda |
| 5 | `supabase/migrations/0007_territorio_opcional.sql` | Territorio opcional (solo presencia) |
| 6 | `supabase/migrations/0008_eventos.sql` | Catálogo de eventos + permisos `events.*` |

### Si reactivaste el proyecto viejo (escenario A)

| # | Archivo | Qué hace |
|---|---|---|
| 1 | `supabase/migrations/0002_territorio_producto.sql` | Territorio y pago en especie |
| 2 | `supabase/migrations/0003_corregir_comparables.sql` | Corrige montos que eran placeholder |
| 3 | `supabase/migrations/0004_rbac.sql` | Perfiles, roles, permisos |
| 4 | `supabase/migrations/0005_endurecimiento_rls.sql` | 🔴 **Cierra los dos hallazgos CRITICAL** |
| 5 | `supabase/migrations/0006_marca_contacto.sql` | Marca y contacto |
| 6 | `supabase/migrations/0007_territorio_opcional.sql` | Territorio opcional (solo presencia) |
| 7 | `supabase/migrations/0008_eventos.sql` | Catálogo de eventos + permisos `events.*` |

---

## Paso 5 — Darte el rol de administrador

Después de **entrar a la app al menos una vez** (el trigger de `0004` te crea
el perfil al registrarte), corre en el SQL Editor, cambiando el correo:

```sql
update perfiles set status = 'ACTIVE'
where lower(email) = lower('TU_CORREO@ejemplo.mx');

insert into usuario_roles (usuario_id, rol_id)
select pf.id, r.id
from perfiles pf cross join roles r
where lower(pf.email) = lower('TU_CORREO@ejemplo.mx')
  and r.nombre = 'SUPER_ADMIN'
on conflict do nothing;
```

---

## Paso 6 — Verificar que quedó bien

Estas cuatro consultas están al final de `0005_endurecimiento_rls.sql`.
**Córrelas: son la diferencia entre "creo que quedó" y "quedó".**

**6.1 — Ninguna tabla sin RLS** (debe regresar 0 renglones)
```sql
select tablename from pg_tables
where schemaname = 'public' and rowsecurity = false;
```

**6.2 — Ninguna política que conceda a todo el mundo** (debe regresar 0)
```sql
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and qual = 'true';
```

**6.3 — Sin sesión, `comparables` ya no entrega datos** (debe regresar `[]`)
```bash
curl "https://<tu-proyecto>.supabase.co/rest/v1/comparables?select=*" \
  -H "apikey: <anon key>"
```
> Si esto devuelve los montos de los patrocinios, el hallazgo CRITICAL #1
> **sigue abierto** y `0005` no se aplicó bien.

**6.4 — El guardado directo desde el navegador está revocado** (debe dar
401/403, no 201). El comando completo está comentado al final de `0005`.

---

## Paso 7 — Google OAuth (pendiente aparte)

El login lleva semanas roto con `redirect_uri_mismatch`. Con proyecto nuevo
las URLs cambian, así que hay que rehacerlo:

1. **Supabase → Authentication → Providers → Google**: copia el **Callback
   URL** que Supabase te muestra ahí. Ese valor exacto es el que importa.
2. **Google Cloud Console → APIs & Services → Credentials**:
   - Revisa **cuántos OAuth 2.0 Client IDs** tienes. El diagnóstico anterior
     fue que había más de uno y las credenciales pegadas en Supabase eran de
     un client distinto al que tenía la URL registrada.
   - En el client correcto, pega esa URL en **Authorized redirect URIs** y
     dale **Save** (es el paso que se saltó la vez pasada).
3. Copia **Client ID** y **Client Secret** de **ese mismo** client a Supabase.
4. En Supabase → Authentication → URL Configuration, pon tu dominio de Vercel
   en **Site URL** y en **Redirect URLs**.

---

## Qué avisarme cuando termines

Con esto puedo seguir sin trabas:

- [ ] La URL del proyecto de Supabase (`https://<...>.supabase.co`) — es
      pública, se puede compartir sin problema
- [ ] Qué migraciones corriste y si alguna dio error
- [ ] El resultado de las verificaciones 6.1 a 6.4
- [ ] Si el login con Google ya completa

**Nunca me mandes la `service_role` key ni la contraseña de la base.** No las
necesito: yo trabajo sobre el código, y las llaves viven en Vercel y en tu
`.env.local`.

---

## Si algo sale mal

| Síntoma | Causa probable |
|---|---|
| La app entera responde 500 | Una de las dos variables `NEXT_PUBLIC_` está vacía. El código ya degrada a "sin sesión" si faltan **ambas**, pero revisa que ninguna quedó a medias |
| "No se pudo guardar la cotización" | `0005` aplicada sin `SUPABASE_SERVICE_ROLE_KEY` en Vercel |
| El racional dice "sin comparables" | Faltó el seed de `comparables`, o `0005` sin sesión iniciada |
| `redirect_uri_mismatch` | Paso 7, punto 2: el Save que se salta |
| Guardar funciona pero no aparece en el listado | RLS: revisa que el `user_id` guardado sea el tuyo |
