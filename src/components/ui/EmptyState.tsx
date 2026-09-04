import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./Icon";

/**
 * Estado vacío. Regla del design system: un estado vacío siempre dice QUÉ
 * falta y ofrece la ACCIÓN para resolverlo. Un párrafo gris explicando que
 * no hay nada no es un estado vacío, es relleno.
 */
export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-lg border border-line-subtle bg-sunken text-fg-subtle">
        <Icon name={icon} size={20} />
      </span>
      <div className="max-w-sm">
        <p className="text-sm font-medium text-fg">{title}</p>
        {description && <p className="mt-1 text-xs text-fg-subtle">{description}</p>}
      </div>
      {action}
    </div>
  );
}
