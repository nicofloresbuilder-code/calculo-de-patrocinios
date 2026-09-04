/**
 * Punto de entrada seguro para cliente y servidor.
 * `session.ts` NO se reexporta aquí a propósito: importa `server-only` y
 * debe importarse por su ruta completa desde código de servidor.
 */
export * from "./permissions";
export * from "./can";
