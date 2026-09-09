import { createBrowserClient } from "@supabase/ssr";
import { cookieOptions } from "./cookieOptions";

/**
 * Qué variables públicas le faltan al bundle, por nombre.
 *
 * Existe para que un fallo de configuración se pueda diagnosticar desde la
 * pantalla, sin abrir la consola del navegador. Las `NEXT_PUBLIC_*` se
 * incrustan en tiempo de COMPILACIÓN: si el despliegue se construyó sin
 * ellas, agregarlas después no arregla nada hasta volver a desplegar — y ese
 * detalle es justo el que hace perder una tarde.
 *
 * Se leen por nombre completo a propósito: Next las sustituye textualmente,
 * así que `process.env[nombre]` no funcionaría.
 */
export function variablesPublicasFaltantes(): string[] {
  return [
    process.env.NEXT_PUBLIC_SUPABASE_URL ? null : "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? null
      : "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter((v): v is string => v !== null);
}

/** Cliente de Supabase para Client Components. Usa la anon key (pública, RLS ON). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions },
  );
}
