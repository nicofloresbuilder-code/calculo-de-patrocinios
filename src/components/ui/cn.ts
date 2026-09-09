/**
 * Une clases condicionalmente. No hace merge de conflictos de Tailwind a
 * propósito: las primitivas de este directorio son la única fuente de sus
 * propias clases base, y el `className` que reciben se concatena al final,
 * que es donde la cascada ya lo hace ganar. Evita una dependencia
 * (`clsx` + `tailwind-merge`) para un problema que aquí no tenemos.
 */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
