import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./Icon";
import type { Tone } from "./Badge";

type AlertTone = Extract<Tone, "info" | "success" | "warning" | "danger">;

const TONES: Record<AlertTone, { box: string; icon: IconName }> = {
  info: { box: "border-info/65 bg-info/10 text-info", icon: "info" },
  success: { box: "border-success/65 bg-success/10 text-success", icon: "check" },
  warning: { box: "border-warning/65 bg-warning/10 text-warning", icon: "warning" },
  danger: { box: "border-danger/65 bg-danger/10 text-danger", icon: "alert" },
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div
      // Los errores se anuncian; el resto solo se expone como región.
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-md border p-3", t.box, className)}
    >
      <Icon name={t.icon} size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-medium">{title}</p>}
        {children && (
          <div className={cn("text-xs text-fg-muted", title && "mt-1")}>{children}</div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
