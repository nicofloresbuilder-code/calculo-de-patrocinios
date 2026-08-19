export function Header() {
  return (
    <header className="border-b border-aforo-panel-border bg-aforo-bg-header px-6 py-5 sm:px-10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="font-serif text-3xl font-bold tracking-tight">AFORO</h1>
          <span className="text-aforo-accent">Cotizador de patrocinios</span>
        </div>
        <p className="text-sm text-aforo-fg-muted">Nueva cotización</p>
      </div>
    </header>
  );
}
