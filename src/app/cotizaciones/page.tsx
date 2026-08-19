import Link from "next/link";
import { Header } from "@/components/Header";
import { Panel } from "@/components/Panel";
import { formatMXN } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

interface CotizacionRow {
  id: string;
  nombre_evento: string;
  precio_min: number | null;
  precio_objetivo: number | null;
  precio_max: number | null;
  creado_en: string;
}

export default async function CotizacionesPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="mx-auto w-full max-w-3xl px-6 py-8 sm:px-10">
          <Panel title="Mis cotizaciones">
            <p className="text-sm text-aforo-fg-muted">
              Supabase todavía no está conectado en este ambiente.
            </p>
          </Panel>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="mx-auto w-full max-w-3xl px-6 py-8 sm:px-10">
          <Panel title="Mis cotizaciones">
            <p className="text-sm text-aforo-fg-muted">
              Inicia sesión con Google (arriba a la derecha) para ver tus
              cotizaciones guardadas.
            </p>
          </Panel>
        </main>
      </div>
    );
  }

  // RLS ("usuario ve solo sus cotizaciones") ya filtra por auth.uid() = user_id;
  // no hace falta un .eq('user_id', ...) manual.
  const { data: cotizaciones, error } = await supabase
    .from("cotizaciones")
    .select("id, nombre_evento, precio_min, precio_objetivo, precio_max, creado_en")
    .order("creado_en", { ascending: false })
    .returns<CotizacionRow[]>();

  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-6 py-8 sm:px-10">
        <div className="mb-4">
          <Link href="/" className="text-sm text-aforo-accent hover:underline">
            ← Nueva cotización
          </Link>
        </div>
        <Panel title="Mis cotizaciones">
          {error && <p className="text-sm text-red-400">{error.message}</p>}
          {!error && (!cotizaciones || cotizaciones.length === 0) && (
            <p className="text-sm text-aforo-fg-muted">
              Todavía no has guardado ninguna cotización.
            </p>
          )}
          {!error && cotizaciones && cotizaciones.length > 0 && (
            <ul className="divide-y divide-aforo-panel-border">
              {cotizaciones.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-aforo-fg">{c.nombre_evento}</p>
                    <p className="text-xs text-aforo-fg-muted">
                      {new Date(c.creado_en).toLocaleDateString("es-MX", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <p className="text-sm text-aforo-accent">
                    {c.precio_objetivo != null ? formatMXN(c.precio_objetivo) : "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </main>
    </div>
  );
}
