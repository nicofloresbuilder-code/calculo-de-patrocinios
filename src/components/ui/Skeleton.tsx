import { cn } from "./cn";

/** Placeholder de carga. Debe tener la forma del contenido que va a llegar. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-sm bg-line-subtle", className)}
    />
  );
}

/** Varias líneas de texto en carga. La última sale más corta, como el texto real. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
