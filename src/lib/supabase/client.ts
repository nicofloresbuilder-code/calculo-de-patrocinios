import { createBrowserClient } from "@supabase/ssr";
import { cookieOptions } from "./cookieOptions";

/** Cliente de Supabase para Client Components. Usa la anon key (pública, RLS ON). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions },
  );
}
