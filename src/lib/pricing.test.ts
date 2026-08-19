import { test } from "node:test";
import assert from "node:assert/strict";
import { computePrice } from "./pricing.ts";

// Comparable real de docs/PACKET.md / BUILD_PROMPT.md: Match Cup · Frontón Bucareli.
// Cifra negociada real: $300,000 MXN (placeholder hasta el pase mecánico de Commit 7).
const MATCH_CUP = {
  activacion: "proveedor" as const,
  aforo: 2000,
  dias: 1,
  lineup: "C" as const,
  exclusiva: false,
  ciudad_tier: "tier1" as const,
};

test("computePrice regresa un rango min < objetivo < max para Match Cup", () => {
  const result = computePrice(MATCH_CUP);

  assert.ok(result.min > 0, "min debe ser positivo");
  assert.ok(result.min < result.objetivo, "min debe ser menor al objetivo");
  assert.ok(result.objetivo < result.max, "objetivo debe ser menor al max");

  // min = objetivo * 0.75, max = objetivo * 1.3 (según la fórmula)
  assert.ok(Math.abs(result.min - result.objetivo * 0.75) < 1e-6);
  assert.ok(Math.abs(result.max - result.objetivo * 1.3) < 1e-6);
});

test("computePrice usa la base de activación correcta", () => {
  const result = computePrice(MATCH_CUP);
  assert.equal(result.base, 300_000); // BASE_ACTIVACION.proveedor
});

test("el desglose normaliza aproximadamente a 100", () => {
  const result = computePrice(MATCH_CUP);
  const suma = Object.values(result.desglose).reduce((a, b) => a + b, 0);
  // Math.round por variable puede desviar la suma en +/-3 respecto a 100
  assert.ok(Math.abs(suma - 100) <= 3, `la suma del desglose fue ${suma}`);
});

test("computePrice es determinista (mismo input, mismo output)", () => {
  const a = computePrice(MATCH_CUP);
  const b = computePrice(MATCH_CUP);
  assert.deepEqual(a, b);
});

// Pase mecánico (Commit 7, DECISIONS.md): los 3 comparables reales que el
// usuario negoció, con las cifras reales confirmadas (no las placeholder
// del seed SQL). Estos tests documentan dónde quedó la fórmula después del
// ajuste al piso de aforo — no todos pasan un margen estricto, eso es
// evidencia real de qué falta calibrar, no un bug oculto.
const ULTRA_MEXICO = {
  activacion: "oficial" as const,
  aforo: 45000,
  dias: 3,
  lineup: "A" as const,
  exclusiva: true,
  ciudad_tier: "tier1" as const,
};
const GOLEIRO = {
  activacion: "oficial" as const,
  aforo: 15000,
  dias: 5,
  lineup: "B" as const,
  exclusiva: true,
  ciudad_tier: "tier1" as const,
};

test("pase mecánico: Ultra México/Sprite queda dentro de ±10% del real ($5M)", () => {
  const result = computePrice(ULTRA_MEXICO);
  const desvio = Math.abs(result.objetivo - 5_000_000) / 5_000_000;
  assert.ok(desvio <= 0.1, `objetivo=${result.objetivo}, desvío=${(desvio * 100).toFixed(1)}%`);
});

test("pase mecánico: Match Cup mejora tras subir el piso de aforo (antes -64%, ahora ≤ -20%)", () => {
  const result = computePrice(MATCH_CUP);
  const desvio = (result.objetivo - 300_000) / 300_000;
  assert.ok(desvio >= -0.2, `objetivo=${result.objetivo}, desvío=${(desvio * 100).toFixed(1)}%`);
});

test("pase mecánico: Goleiro/Michelob sigue sobrestimado — pendiente, no oculto", () => {
  const result = computePrice(GOLEIRO);
  const desvio = (result.objetivo - 1_000_000) / 1_000_000;
  // Documentamos el desvío real en vez de forzar un rango que lo esconda.
  // DECISIONS.md explica por qué no se tocó en este pase (aforo=15,000 no
  // cae en el clamp que sí se corrigió) y qué se investigaría después.
  assert.ok(desvio > 0.3, `objetivo=${result.objetivo}, desvío=${(desvio * 100).toFixed(1)}% (se esperaba sobrestimado)`);
});
