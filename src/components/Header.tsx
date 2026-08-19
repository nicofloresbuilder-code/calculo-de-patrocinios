import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthStatus } from "./AuthStatus";

async function getUserEmail(): Promise<string | null> {
  // Guard: hasta que Commit 2 tenga un proyecto real de Supabase conectado
  // (env vars en .env.local / Vercel), no intentamos pegarle a un cliente
  // sin URL — evita romper `next build`/`next dev` en local.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}

export async function Header() {
  const email = await getUserEmail();

  return (
    <header className="border-b border-aforo-panel-border bg-aforo-bg-header px-6 py-5 sm:px-10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="font-serif text-3xl font-bold tracking-tight">AFORO</h1>
          <span className="text-aforo-accent">Cotizador de patrocinios</span>
        </div>
        <div className="flex items-center gap-4">
          {email && (
            <Link
              href="/cotizaciones"
              className="text-sm text-aforo-fg-muted hover:text-aforo-fg"
            >
              Mis cotizaciones
            </Link>
          )}
          <AuthStatus email={email} />
        </div>
      </div>
    </header>
  );
}
