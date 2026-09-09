/**
 * OPCIONES DE COOKIE DE SESIÓN
 * ============================
 * Los valores por defecto de `@supabase/ssr` son:
 *
 *   { path: "/", sameSite: "lax", httpOnly: false, maxAge: 400 días }
 *
 * Dos de esos cuatro no sirven para una herramienta interna:
 *
 *   · `secure` no se fija → en un despliegue que acepte HTTP, la cookie de
 *     sesión viaja en claro. Aquí se fuerza en producción.
 *   · `maxAge` de 400 días → una sesión robada sigue viva más de un año.
 *     Se baja a 7 días; el refresh token de Supabase renueva mientras el
 *     usuario esté activo, así que en la práctica no molesta a nadie.
 *
 * `sameSite: "lax"` se mantiene A PROPÓSITO: `strict` rompería el regreso
 * del proveedor OAuth, que es una navegación de nivel superior desde otro
 * sitio. `lax` ya bloquea el envío en peticiones cross-site que no sean
 * navegación, que es lo que importa para CSRF.
 *
 * `httpOnly: false` es una restricción del diseño de Supabase, no un
 * descuido: `createBrowserClient` lee la cookie con `document.cookie` para
 * hidratar la sesión en el navegador. Ponerlo en `true` rompe ese cliente.
 * Ver SECURITY-AUDIT.md #9 para el camino a sesión 100% server-side, que sí
 * permitiría httpOnly y que necesita tu aprobación.
 */
export const cookieOptions = {
  // Vercel siempre sirve HTTPS. En desarrollo local (http://localhost) la
  // bandera `secure` impediría que el navegador guarde la cookie.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 días
};

/**
 * ¿Está Supabase configurado por completo?
 *
 * Antes cada sitio comprobaba SOLO `NEXT_PUBLIC_SUPABASE_URL`. Con la URL
 * puesta y la anon key vacía —un `.env` a medias, o una variable que no se
 * propagó al deploy— `createServerClient` lanza, y como el proxy corre en
 * TODAS las rutas, la aplicación entera responde 500. Un error de
 * configuración se convertía en una caída total.
 *
 * Requerir las dos hace que ese caso degrade a "sin sesión" en vez de tumbar
 * el sitio.
 */
export function supabaseConfigurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
