import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-aforo-bg p-10 text-center text-aforo-fg">
      <h1 className="font-serif text-2xl font-bold">No se pudo iniciar sesión</h1>
      <p className="text-sm text-aforo-fg-muted">
        Intenta de nuevo desde la pantalla principal.
      </p>
      <Link href="/" className="mt-2 text-sm text-aforo-accent underline">
        Volver a Aforo
      </Link>
    </div>
  );
}
