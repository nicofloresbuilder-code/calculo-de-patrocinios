import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Cifra destacada. Un solo lugar decide cómo se ve "el número que importa",
 * para que el rango de precio, el valor real del deal y cualquier KPI futuro
 * se lean como la misma clase de dato.
 */
export function Metric({
  label,
  value,
  detail,
  size = "md",
  tone = "default",
  className,
}: {
  label?: string;
  value: ReactNode;
  detail?: ReactNode;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "primary";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">
          {label}
        </p>
      )}
      <p
        className={cn(
          "font-semibold tracking-tight",
          label && "mt-1.5",
          size === "sm" && "text-xl",
          size === "md" && "text-2xl",
          size === "lg" && "text-2xl sm:text-3xl",
          tone === "primary" ? "text-primary" : "text-fg",
        )}
      >
        {value}
      </p>
      {detail && <div className="mt-1.5 text-xs text-fg-muted">{detail}</div>}
    </div>
  );
}
