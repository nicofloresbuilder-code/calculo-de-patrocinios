import { test } from "node:test";
import assert from "node:assert/strict";
import { computePrice, territorioFactor } from "./pricing.ts";

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

/**
 * GOLEIRO YA NO ES UN ANCLA DE CALIBRACIÓN — decisión de Nicolás
 * (2026-08-30).
 *
 * Durante dos sesiones se persiguió su desvío como si fuera un error de la
 * fórmula. Con los datos completos (15,000 asistentes en total en 5 días,
 * territorio 10x10) el modelo lo valúa en ~$2.3M contra el $1M en que
 * cerró. Se le plantearon las dos explicaciones posibles —que el deal se
 * cerró por debajo de su valor, o que los eventos tipo FanFest valgan
 * menos que un festival del mismo aforo— y Nicolás confirmó la primera:
 * fue un mal deal, y de aquí en adelante no se dan esos descuentos.
 *
 * O sea que aquí la fórmula NO está fallando: está diciendo que ese
 * patrocinio se vendió a la mitad de lo que valía. Calibrar contra él
 * habría metido ese descuento a todas las cotizaciones futuras.
 *
 * Se conserva el test como registro de esa lectura, no como pendiente.
 */
test("Goleiro: el modelo lo valúa MUY por encima de lo que se cerró (deal subvaluado)", () => {
  const result = computePrice(GOLEIRO);
  const desvio = (result.objetivo - 1_000_000) / 1_000_000;
  assert.ok(
    desvio > 0.3,
    `objetivo=${result.objetivo}, desvío=${(desvio * 100).toFixed(1)}% — si esto baja, alguien recalibró contra un deal que Nicolás marcó como subvaluado`,
  );
});

// ─────────────────────────────────────────────────────────────────────
// Territorio opcional (solo presencia, sin espacio físico)
// ─────────────────────────────────────────────────────────────────────

test("sin tiene_territorio explícito, el precio no cambia (compatibilidad)", () => {
  // Este es el test que protege la calibración: agregar el campo no debe
  // mover ni un peso de lo que ya estaba validado contra deals reales.
  const evento = {
    activacion: "oficial" as const,
    aforo: 15000,
    dias: 2,
    lineup: "B" as const,
    exclusiva: true,
    ciudad_tier: "tier1" as const,
    territorio_lado: 5,
  };
  assert.equal(
    computePrice(evento).objetivo,
    computePrice({ ...evento, tiene_territorio: true }).objetivo,
  );
});

test("sin espacio físico el precio baja y no depende del lado", () => {
  const base = {
    activacion: "oficial" as const,
    aforo: 15000,
    dias: 2,
    lineup: "B" as const,
    exclusiva: true,
    ciudad_tier: "tier1" as const,
  };
  const conEspacio = computePrice({ ...base, territorio_lado: 5 });
  const soloPresencia = computePrice({ ...base, tiene_territorio: false, territorio_lado: 5 });

  assert.ok(
    soloPresencia.objetivo < conEspacio.objetivo,
    "solo presencia debe costar menos que una activación de 5×5",
  );

  // El lado se ignora por completo cuando no hay espacio físico: si influyera,
  // el usuario estaría pagando por metros que no existen.
  for (const lado of [1, 5, 10, 30]) {
    assert.equal(
      computePrice({ ...base, tiene_territorio: false, territorio_lado: lado }).objetivo,
      soloPresencia.objetivo,
      `el lado ${lado} no debe afectar un deal de solo presencia`,
    );
  }
});

test("el preset de 3×3 interpola entre las anclas reales de 2 y 5", () => {
  // Cambiar el botón de la UI de 2×2 a 3×3 no toca las anclas de calibración.
  const f2 = territorioFactor(2);
  const f3 = territorioFactor(3);
  const f5 = territorioFactor(5);
  assert.equal(f2, 0.34, "el ancla real de 2×2 sigue en su lugar");
  assert.equal(f5, 1.0, "el ancla real de 5×5 sigue en su lugar");
  assert.ok(f3 > f2 && f3 < f5, "3×3 debe caer entre las dos anclas");
});

test("ANCLA: solo presencia reproduce el precio real de Nicolás", () => {
  // $1,000,000 para el evento del Grupo A sin espacio físico (2026-09-08).
  // Mismo caso con el que se calibraron las 4 anclas de territorio.
  const r = computePrice({
    activacion: "oficial",
    aforo: 15000,
    dias: 2,
    lineup: "B",
    exclusiva: true,
    ciudad_tier: "tier1",
    tiene_territorio: false,
  });
  const desvio = Math.abs(r.objetivo / 1_000_000 - 1);
  assert.ok(
    desvio < 0.01,
    `solo presencia debería dar ~$1,000,000, dio ${Math.round(r.objetivo)} (desvío ${(desvio * 100).toFixed(2)}%)`,
  );
});

test("DOCUMENTA LA INCONSISTENCIA: solo presencia sale más caro que un stand chico", () => {
  // Este test NO valida un comportamiento deseado: fija uno que está en
  // revisión, para que si alguien cambia las anclas o el factor, se entere de
  // que esto se movió. Ver la nota de SIN_TERRITORIO_FACTOR.
  const base = {
    activacion: "oficial" as const,
    aforo: 15000,
    dias: 2,
    lineup: "B" as const,
    exclusiva: true,
    ciudad_tier: "tier1" as const,
  };
  const sinEspacio = computePrice({ ...base, tiene_territorio: false }).objetivo;
  const dosPorDos = computePrice({ ...base, territorio_lado: 2 }).objetivo;
  const tresPorTres = computePrice({ ...base, territorio_lado: 3 }).objetivo;
  const cincoPorCinco = computePrice({ ...base, territorio_lado: 5 }).objetivo;

  assert.ok(sinEspacio > dosPorDos, "hoy: sin espacio > 2×2 (pendiente de resolver)");
  assert.ok(sinEspacio > tresPorTres, "hoy: sin espacio > 3×3 (pendiente de resolver)");
  assert.ok(sinEspacio < cincoPorCinco, "sin espacio sí debe costar menos que un 5×5");
});
