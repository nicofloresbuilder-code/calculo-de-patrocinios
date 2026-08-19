"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthStatus({ email }: { email: string | null }) {
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function signOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.reload();
  }

  if (email) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-aforo-fg-muted">{email}</span>
        <button
          onClick={signOut}
          disabled={loading}
          className="text-aforo-accent hover:underline disabled:opacity-50"
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={signInWithGoogle}
      disabled={loading}
      className="rounded-md border border-aforo-panel-border bg-aforo-input px-3 py-1.5 text-sm text-aforo-fg transition-colors hover:border-aforo-accent disabled:opacity-50"
    >
      Iniciar sesión con Google
    </button>
  );
}
