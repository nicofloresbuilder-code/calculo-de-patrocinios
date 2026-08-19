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
