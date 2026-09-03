import { test } from "node:test";
import assert from "node:assert/strict";
import { computePrice, territorioFactor } from "./pricing.ts";

/**
 * Calibración de territorio con precios REALES de Nicolás (2026-08-30).
 * Mismo evento en los 4 casos, variando SOLO el tamaño de la activación:
 * 15,000 personas · 2 días · line-up B · CDMX · oficial · CON exclusividad.
 *
 * Estos 4 números son el ancla de todo el factor de territorio. Si alguien
 * toca la curva sin recalibrar contra ellos, estos tests truenan.
 */
const EVENTO_CALIBRACION = {
  activacion: "oficial" as const,
  aforo: 15000,
  dias: 2,
  lineup: "B" as const,
  exclusiva: true,
  ciudad_tier: "tier1" as const,
};

const PRECIOS_REALES: { lado: number; real: number }[] = [
  { lado: 2, real: 400_000 },
  { lado: 5, real: 1_200_000 },
  { lado: 10, real: 2_000_000 },
  { lado: 15, real: 3_200_000 },
];

test("el factor de territorio reproduce los 4 precios reales con <3% de desvío", () => {
  for (const { lado, real } of PRECIOS_REALES) {
    const { objetivo } = computePrice({ ...EVENTO_CALIBRACION, territorio_lado: lado });
    const desvio = Math.abs(objetivo - real) / real;
    assert.ok(
      desvio < 0.03,
      `${lado}x${lado}: esperado ~$${real.toLocaleString()}, obtenido $${Math.round(objetivo).toLocaleString()} (${(desvio * 100).toFixed(1)}% de desvío)`,
    );
  }
});

test("5x5 es el estándar implícito: factor = 1.00 (no recalibra lo ya validado)", () => {
  assert.equal(territorioFactor(5), 1.0);
});

test("el precio crece con el territorio, siempre", () => {
  let anterior = 0;
  for (let lado = 1; lado <= 20; lado++) {
    const f = territorioFactor(lado);
    assert.ok(f > anterior, `el factor debe crecer: lado ${lado} dio ${f}, anterior ${anterior}`);
    anterior = f;
  }
});

test("interpola entre anclas (7x7 cae entre 5x5 y 10x10)", () => {
  const f = territorioFactor(7);
  assert.ok(f > territorioFactor(5) && f < territorioFactor(10));
});

test("extrapola arriba de 15x15 sin romperse", () => {
  const f = territorioFactor(20);
  assert.ok(f > territorioFactor(15), "20x20 debe valer más que 15x15");
  assert.ok(Number.isFinite(f));
});

test("un espacio diminuto nunca hace el precio ~0 (hay piso)", () => {
  assert.ok(territorioFactor(0.5) >= 0.15);
  assert.ok(territorioFactor(1) > 0);
});

test("el territorio aparece en el desglose por variable", () => {
  const { desglose } = computePrice({ ...EVENTO_CALIBRACION, territorio_lado: 15 });
  assert.ok("territorio" in desglose, "el desglose debe incluir territorio");
  assert.ok(desglose.territorio > 0, "en 15x15 el territorio debe pesar en el desglose");
});

test("sin especificar territorio, asume 5x5 y no cambia el precio histórico", () => {
  const conDefault = computePrice(EVENTO_CALIBRACION);
  const explicito5 = computePrice({ ...EVENTO_CALIBRACION, territorio_lado: 5 });
  assert.equal(conDefault.objetivo, explicito5.objetivo);
});

/**
 * Caso B1 de la calibración: 2,000 pers · 1 día · line-up C · CDMX ·
 * proveedor · CON exclusividad · 5x5 → Nicolás cotiza $300,000.
 */
test("caso B1 (evento chico) queda dentro del 10%", () => {
  const { objetivo } = computePrice({
    activacion: "proveedor",
    aforo: 2000,
    dias: 1,
    lineup: "C",
    exclusiva: true,
    ciudad_tier: "tier1",
    territorio_lado: 5,
  });
  const desvio = Math.abs(objetivo - 300_000) / 300_000;
  assert.ok(desvio < 0.1, `B1: esperado ~$300,000, obtenido $${Math.round(objetivo).toLocaleString()}`);
});

/**
 * Caso B2: 45,000 pers · 3 días · line-up A · CDMX · NAMING · exclusiva ·
 * 10x10 → precio fijado por Nicolás: $17,000,000.
 *
 * Este ancla vale MENOS que las demás y hay que saberlo al usarla: Nicolás
 * cotizó B2 primero en $6.5M, vio que la fórmula daba $20.6M, y entonces
 * lo subió a $17M. El número salió después de ver el de la fórmula, así
 * que no es un precio observado en frío ni un deal cerrado — a diferencia
 * de Ultra México ($5M real). Ver la nota en BASE_ACTIVACION.
 */
test("caso B2 (naming) reproduce el precio fijado, dentro del 3%", () => {
  const { objetivo } = computePrice({
    activacion: "naming",
    aforo: 45000,
    dias: 3,
    lineup: "A",
    exclusiva: true,
    ciudad_tier: "tier1",
    territorio_lado: 10,
  });
  const desvio = Math.abs(objetivo - 17_000_000) / 17_000_000;
  assert.ok(
    desvio < 0.03,
    `B2: esperado ~$17,000,000, obtenido $${Math.round(objetivo).toLocaleString()} (${(desvio * 100).toFixed(1)}%)`,
  );
});

/**
 * Ultra México es el ancla FUERTE: deal real cerrado en $5,000,000
 * (45,000 pers · 3 días · line-up A · CDMX · oficial · exclusiva).
 *
 * Se fija aquí para que cualquier recalibración futura de `oficial` tenga
 * que enfrentarlo. Ojo: asume territorio 5x5 porque no sabemos cuál tuvo
 * en realidad — ese es el hueco abierto que impide cerrar la calibración.
 */
test("ANCLA FUERTE: Ultra México (deal real) sigue cuadrando", () => {
  const { objetivo } = computePrice({
    activacion: "oficial",
    aforo: 45000,
    dias: 3,
    lineup: "A",
    exclusiva: true,
    ciudad_tier: "tier1",
    territorio_lado: 5,
  });
  const desvio = Math.abs(objetivo - 5_000_000) / 5_000_000;
  assert.ok(desvio < 0.05, `Ultra: obtenido $${Math.round(objetivo).toLocaleString()}`);
});

/**
 * GOLEIRO — parámetros reales confirmados por Nicolás (2026-08-30):
 * 15,000 asistentes EN TOTAL repartidos en 5 días (~3,000/día), y
 * territorio 10x10. Deal real cerrado en $1,000,000.
 *
 * Con eso, Goleiro y el caso A3 forman un PAR CONTROLADO: idénticos en
 * todo (15,000 asistentes, line-up B, CDMX, oficial, exclusiva, 10x10)
 * salvo los días — 2 vs 5 — y el precio se parte a la mitad:
 *
 *     A3, 2 días  -> $2,000,000   (7,500 personas/día)
 *     Goleiro, 5 días -> $1,000,000   (3,000 personas/día)
 *
 * O sea: repartir la MISMA gente en más días BAJA el valor. La fórmula
 * actual hace lo contrario — multiplica aforo × duración, contando la
 * misma gente 5 veces y encima premiando por durar más. Por eso Goleiro
 * sale sobrestimado.
 *
 * El arreglo no es un coeficiente sino estructural: el driver debería ser
 * la DENSIDAD (asistentes/día), no el total × duración. No se aplicó aún
 * porque falta confirmar si el "15,000" del Grupo A también es total (si
 * fuera por día, todo el análisis cambia). Ver DECISIONS.md.
 */
test("PENDIENTE ESTRUCTURAL: Goleiro sobrestima por doble conteo de gente", () => {
  const { objetivo } = computePrice({
    activacion: "oficial",
    aforo: 15000,
    dias: 5,
    lineup: "B",
    exclusiva: true,
    ciudad_tier: "tier1",
    territorio_lado: 10, // confirmado por Nicolás
  });
  assert.ok(
    objetivo > 1_000_000 * 1.5,
    "si Goleiro dejó de sobrestimar, ya se cambió el driver a densidad — actualiza este test",
  );
});
