import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions, supabaseConfigurado } from "@/lib/supabase/cookieOptions";

// Refresca la sesión de Supabase en cada request (patrón estándar de
// @supabase/ssr para Next.js App Router) para que las cookies de auth
// no expiren mientras el usuario navega.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Guard: sin Supabase configurado por completo no hay nada que refrescar.
  // Se exigen AMBAS variables: con la URL puesta y la key vacía, el cliente
  // lanza y —al correr esto en todas las rutas— la app entera daría 500.
  if (!supabaseConfigurado()) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  try {
    await supabase.auth.getUser();
  } catch (error) {
    // Refrescar la sesión es best-effort. Si Supabase está caído o
    // inalcanzable, el usuario navega sin sesión — no se le tumba el sitio.
    console.error("No se pudo refrescar la sesión:", error);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
