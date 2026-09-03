import { test } from "node:test";
import assert from "node:assert/strict";
import { analizarProducto, valorRealDelDeal, SUPUESTOS_DEFAULT } from "./producto.ts";

/** El caso que describió Nicolás: deal de $1M cerrado 50/50. */
const DEAL_50_50 = {
  montoEnProducto: 500_000,
  aforo: 15000,
  dias: 2,
  ...SUPUESTOS_DEFAULT,
};

test("convierte el monto en producto a unidades usando el precio de la marca", () => {
  const r = analizarProducto(DEAL_50_50);
  // $500,000 / $15 por unidad
  assert.equal(r.unidadesRecibidas, 500_000 / 15);
});

test("la capacidad de venta es aforo x días x consumo por persona", () => {
  const r = analizarProducto(DEAL_50_50);
  assert.equal(r.capacidadVenta, 15000 * 2 * 2);
});

test("si cabe en el evento, se liquida completo y el ingreso es puro margen", () => {
  const r = analizarProducto(DEAL_50_50);
  assert.equal(r.seLiquidaCompleto, true);
  assert.equal(r.unidadesSobrantes, 0);
  assert.equal(r.ingresoEstimado, r.unidadesRecibidas * 70);
});

test("vendido a precio de festival, el producto vale MÁS que su valor declarado", () => {
  const r = analizarProducto(DEAL_50_50);
  assert.ok(
    r.multiploSobreDeclarado > 1,
    `esperaba múltiplo > 1, obtuve ${r.multiploSobreDeclarado.toFixed(2)}`,
  );
  // $15 declarado -> $70 de venta = 4.67x
  assert.ok(Math.abs(r.multiploSobreDeclarado - 70 / 15) < 0.01);
});

test("si dan más producto del que el aforo puede consumir, lo que sobra es valor muerto", () => {
  // Evento chico, mucho producto: 2,000 personas 1 día = 4,000 unidades de capacidad
  const r = analizarProducto({
    montoEnProducto: 500_000, // 33,333 unidades
    aforo: 2000,
    dias: 1,
    ...SUPUESTOS_DEFAULT,
  });
  assert.equal(r.seLiquidaCompleto, false);
  assert.equal(r.capacidadVenta, 4000);
  assert.equal(r.unidadesVendibles, 4000);
  assert.ok(r.unidadesSobrantes > 0);
  assert.ok(r.valorMuerto > 0, "el producto que no se vende debe contarse como valor muerto");
});

test("el monto máximo recomendado marca el límite de lo que sí es líquido", () => {
  const r = analizarProducto({ ...DEAL_50_50, aforo: 2000, dias: 1 });
  // 4,000 unidades de capacidad x $15 declarados = $60,000
  assert.equal(r.montoMaximoRecomendado, 4000 * 15);

  // Aceptar exactamente el máximo debe liquidarse completo.
  const alLimite = analizarProducto({
    ...DEAL_50_50,
    aforo: 2000,
    dias: 1,
    montoEnProducto: r.montoMaximoRecomendado,
  });
  assert.equal(alLimite.seLiquidaCompleto, true);
});

test("el valor real del deal separa lo nominal de lo que sí se vuelve dinero", () => {
  const producto = analizarProducto(DEAL_50_50);
  const { valorNominal, valorReal, diferencia } = valorRealDelDeal(500_000, producto);

  assert.equal(valorNominal, 1_000_000, "nominal = efectivo + valor declarado");
  assert.ok(valorReal > valorNominal, "a precio de festival, el deal vale más de lo que dice");
  assert.equal(diferencia, valorReal - valorNominal);
});

test("un deal chico en evento chico puede valer MENOS que su valor nominal", () => {
  const producto = analizarProducto({
    montoEnProducto: 500_000,
    aforo: 1000,
    dias: 1,
    ...SUPUESTOS_DEFAULT,
  });
  const { valorNominal, valorReal } = valorRealDelDeal(500_000, producto);
  // 1,000 x 1 x 2 = 2,000 unidades vendibles x $70 = $140,000
  // contra $500,000 declarados -> el deal vale menos de lo que aparenta
  assert.ok(valorReal < valorNominal, "si no se puede liquidar, el deal vale menos");
});

test("no truena con ceros ni con datos vacíos", () => {
  const r = analizarProducto({
    montoEnProducto: 0,
    aforo: 0,
    dias: 0,
    precioUnitarioMarca: 0,
    precioVentaFestival: 0,
    unidadesPorPersonaDia: 0,
  });
  assert.equal(r.unidadesRecibidas, 0);
  assert.equal(r.ingresoEstimado, 0);
  assert.equal(r.multiploSobreDeclarado, 0);
  assert.ok(Number.isFinite(r.montoMaximoRecomendado));
});
