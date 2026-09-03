/**
 * Análisis de pago en especie (producto).
 *
 * El modelo real del negocio, según Nicolás: un deal de $1M puede cerrarse
 * 50/50 — $500K en efectivo y $500K en producto. Ese producto NO nos cuesta
 * (es parte del pago), lo vendemos en el festival, y por lo tanto toda la
 * venta es margen.
 *
 * La pregunta que esto contesta no es "¿cuánto vendemos?" sino:
 *
 *     ¿ese producto vale de verdad lo que la marca dice que vale?
 *
 * Y casi nunca vale exactamente eso:
 *  - Vale MÁS si se vende a precio de festival (una lata valuada en $15
 *    que vendemos en $70 multiplica su valor declarado).
 *  - Vale MENOS si nos dan más producto del que el aforo puede consumir:
 *    lo que sobra es valor muerto, no dinero.
 *
 * Por eso el output clave es el MONTO MÁXIMO RECOMENDADO — cuánto producto
 * conviene aceptar antes de que deje de ser líquido. Palabras de Nicolás:
 * "lo importante es que nosotros lo podamos hacer líquido fácilmente".
 *
 * Nada de esto lo decide un LLM: es aritmética sobre supuestos explícitos
 * y editables en pantalla.
 */

/** Supuestos por defecto — inventados como punto de partida, editables en la UI. */
export const SUPUESTOS_DEFAULT = {
  /** A cuánto valúa la marca cada unidad que entrega (precio de lista). */
  precioUnitarioMarca: 15,
  /** A cuánto se vende esa unidad dentro del festival. */
  precioVentaFestival: 70,
  /** Unidades DE ESTA MARCA que consume una persona por día. */
  unidadesPorPersonaDia: 2,
};

export interface ProductoInput {
  /** Parte del deal que llega en producto, a valor declarado por la marca. */
  montoEnProducto: number;
  aforo: number;
  dias: number;
  precioUnitarioMarca: number;
  precioVentaFestival: number;
  unidadesPorPersonaDia: number;
}

export interface ProductoResult {
  /** Unidades que entrega la marca = monto / precio unitario declarado. */
  unidadesRecibidas: number;
  /** Cuántas unidades puede absorber el evento = aforo × días × consumo. */
  capacidadVenta: number;
  /** Las que sí se pueden vender = min(recibidas, capacidad). */
  unidadesVendibles: number;
  /** Las que sobran — valor declarado que no se vuelve dinero. */
  unidadesSobrantes: number;
  /** Ingreso real esperado, todo margen (el producto no costó). */
  ingresoEstimado: number;
  /** Valor que la marca le asignó a ese producto. */
  valorDeclarado: number;
  /** Valor declarado que se queda sin vender. */
  valorMuerto: number;
  /** Cuántas veces el ingreso real supera (o no) al valor declarado. */
  multiploSobreDeclarado: number;
  /** Máximo en producto que conviene aceptar para que siga siendo líquido. */
  montoMaximoRecomendado: number;
  /** true si todo el producto se puede vender dentro del evento. */
  seLiquidaCompleto: boolean;
}

export function analizarProducto({
  montoEnProducto,
  aforo,
  dias,
  precioUnitarioMarca,
  precioVentaFestival,
  unidadesPorPersonaDia,
}: ProductoInput): ProductoResult {
  // Guardas: sin precio unitario no hay unidades que calcular.
  const precioUnitario = precioUnitarioMarca > 0 ? precioUnitarioMarca : 0;
  const unidadesRecibidas = precioUnitario > 0 ? montoEnProducto / precioUnitario : 0;

  const capacidadVenta = Math.max(0, aforo) * Math.max(0, dias) * Math.max(0, unidadesPorPersonaDia);

  const unidadesVendibles = Math.min(unidadesRecibidas, capacidadVenta);
  const unidadesSobrantes = Math.max(0, unidadesRecibidas - capacidadVenta);

  const ingresoEstimado = unidadesVendibles * Math.max(0, precioVentaFestival);
  const valorMuerto = unidadesSobrantes * precioUnitario;

  return {
    unidadesRecibidas,
    capacidadVenta,
    unidadesVendibles,
    unidadesSobrantes,
    ingresoEstimado,
    valorDeclarado: montoEnProducto,
    valorMuerto,
    multiploSobreDeclarado: montoEnProducto > 0 ? ingresoEstimado / montoEnProducto : 0,
    montoMaximoRecomendado: capacidadVenta * precioUnitario,
    seLiquidaCompleto: unidadesSobrantes === 0,
  };
}

/**
 * Valor total real del deal: el efectivo tal cual, más lo que de verdad
 * se puede convertir en dinero del producto (no su valor declarado).
 */
export function valorRealDelDeal(
  montoEfectivo: number,
  producto: ProductoResult,
): { valorNominal: number; valorReal: number; diferencia: number } {
  const valorNominal = montoEfectivo + producto.valorDeclarado;
  const valorReal = montoEfectivo + producto.ingresoEstimado;
  return { valorNominal, valorReal, diferencia: valorReal - valorNominal };
}
