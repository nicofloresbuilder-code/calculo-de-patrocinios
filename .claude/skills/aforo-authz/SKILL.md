---
name: aforo-authz
description: Agregar o modificar cualquier cosa protegida por permisos en Aforo — endpoints, Server Actions, páginas, módulos de navegación, botones condicionados por rol, o el catálogo de permisos y roles. Úsala ANTES de escribir un endpoint, una Server Action o una pantalla que no deba ver todo el mundo. Impone el orden servidor-primero y evita que la autorización se disperse por la aplicación.
---

# Autorización en Aforo

Modelo RBAC: **Usuario → Roles → Permisos**. Lee `RBAC-ARCHITECTURE.md` para
el diseño completo.

## La regla

**Esconder un control no es seguridad.** Un usuario puede llamar el endpoint
directamente sin pasar nunca por tu interfaz. Toda operación sensible se
verifica en el servidor.

## Orden de trabajo — siempre servidor primero

### 1. ¿Existe el permiso?

`src/lib/auth/permissions.ts`, formato `recurso.accion`. Si falta, agrégalo a
`PERMISSIONS`, asígnalo en `ROLE_PERMISSIONS`, y añade la fila
correspondiente a `supabase/migrations/0004_rbac.sql`. **Los tres tienen que
coincidir** — hay un test que lo comprueba.

### 2. Protege la operación (esto es lo que cuenta)

```ts
// Route Handler o Server Action
import { AuthorizationError, requirePermission } from "@/lib/auth/session";

try {
  const ctx = await requirePermission("users.delete");
} catch (err) {
  if (err instanceof AuthorizationError) {
    return NextResponse.json({ error: "…" }, { status: err.status }); // 401 o 403
  }
  throw err;
}
```

```ts
// Página (Server Component): permite redirigir con contexto
const ctx = await getAuthzContext();
if (!can(ctx, "users.view")) { /* 403 */ }
```

`getAuthzContext()` está memoizada con `React.cache`: llamarla varias veces en
un render cuesta una sola lectura de sesión.

### 3. Solo entonces, la interfaz

```tsx
<Can permission="users.create">
  <Button variant="primary" icon="plus">Nuevo usuario</Button>
</Can>

const { can, hasRole } = usePermissions();
```

### 4. Y el módulo en la navegación

`src/lib/navigation.ts`, con sus `permissions`. La barra lateral se filtra
sola. **Esto no protege la ruta** — la ruta la protege el paso 2/3.

### 5. Test

`src/lib/authz.test.ts`. Añade el caso: quién sí y quién no.

```bash
npm test
```

## Prohibiciones

1. **Nunca `hasRole()` para decidir un acceso.** Si escribes
   `hasRole(ctx, "ADMIN")` para habilitar algo, lo que falta es un permiso en
   el catálogo. `hasRole` es solo para presentación (mostrar la etiqueta del
   rol).
2. **Nunca importar `src/lib/auth/session.ts` desde un Client Component.**
   Está marcado `server-only`; el contexto baja por `AuthzProvider`.
3. **Nunca resolver permisos en el cliente.** El servidor los calcula una vez
   y los pasa.
4. **Nunca fallar abierto.** Si Supabase no responde, el contexto es
   `ANONYMOUS`, no "déjalo pasar".
5. **Nunca desactivar una comprobación para que algo funcione.** Si un flujo
   se rompe, el permiso o el rol están mal asignados.
6. **Nunca exponer un secreto al cliente.** Sin prefijo `NEXT_PUBLIC_` no
   llega al bundle: `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
   `AFORO_SUPER_ADMIN_EMAILS`.
7. **Nunca hard delete de usuarios.** La baja es `status` (`INACTIVE` /
   `SUSPENDED`), para conservar historial y no dejar cotizaciones huérfanas.

## Errores al usuario

`console.error` para el detalle técnico, mensaje de producto para la persona.
Nunca devuelvas el error crudo de Supabase o de Postgres a la interfaz.

## Estado actual

`getAuthzContext()` todavía no lee de la base de datos: la migración
`0004_rbac.sql` está escrita pero **no aplicada**. Cuando se aplique, el único
código que cambia es el cuerpo de esa función. Ninguna llamada a
`can()` / `requirePermission()` / `<Can>` cambia.
