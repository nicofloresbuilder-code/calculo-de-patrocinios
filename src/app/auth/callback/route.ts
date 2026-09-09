import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  LIMITES,
  checkRateLimit,
  identificarSolicitante,
} from "@/lib/rateLimit";

/**
 * Supabase redirige aquí tras el login con un `?code=...` que hay que
 * canjear por una sesión.
 */

/**
 * Saneado del parámetro `next` — prevención de redirección abierta.
 *
 * `next` lo controla quien arma el enlace. Sin validar, un atacante puede
 * mandar a la víctima a `/auth/callback?next=//evil.example` y usar el
 * dominio legítimo como trampolín de phishing.
 *
 * Solo se acepta una ruta relativa al propio sitio: un `/` inicial, y
 * ninguna de las formas que un navegador interpreta como otro host.
 */
function destinoSeguro(next: string | null): string {
  if (!next) return "/";
  // Debe empezar con una sola diagonal. `//host` y `/\host` son
  // protocol-relative en varios navegadores → salen del sitio.
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  // Nada de URLs absolutas disfrazadas ni saltos de línea (CRLF injection).
  if (/^[a-z][a-z0-9+.-]*:/i.test(next) || /[\r\n]/.test(next)) return "/";
  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = destinoSeguro(searchParams.get("next"));

  // Rate limit por IP: el callback acepta un `code` de un tercero, así que
  // es un punto legítimo donde limitar intentos repetidos.
  const rl = checkRateLimit(
    identificarSolicitante(request, null),
    LIMITES.authCallback.limite,
    LIMITES.authCallback.ventanaMs,
  );
  if (!rl.permitido) {
    return NextResponse.redirect(`${origin}/auth/error?motivo=rate_limit`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // El detalle del error se queda en el servidor.
    console.error("Fallo al canjear el código OAuth:", error.message);
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
