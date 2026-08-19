import type { ReactNode } from "react";

export function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-aforo-panel-border bg-aforo-panel p-6 ${className}`}
    >
      {title && (
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-aforo-fg-muted">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
