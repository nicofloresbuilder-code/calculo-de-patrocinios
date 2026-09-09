import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PERMISSIONS,
  ROLES,
  permissionsForRole,
  type RoleName,
} from "./auth/permissions.ts";
import { can } from "./auth/can.ts";
import { validateEventoCatalogo, esFechaISOValida } from "./validateEventoCatalogo.ts";
import { parseEventoCatalogo } from "./validation/parseEventoCatalogo.ts";
import { parseEventoInput } from "./validation/parseEvento.ts";
import { NAVIGATION, isNavItemVisible } from "./navigation.ts";
import type { EventoCatalogoInput } from "./types.ts";

function ctxFor(role: RoleName) {
  return {
    userId: "u1",
    email: "u@ejemplo.mx",
    displayName: "U",
    role,
    permissions: permissionsForRole(role),
  };
}

const EVENTO_OK: EventoCatalogoInput = {
  nombre: "Ultra México 2026",
  aforo: 45_000,
  dias: 3,
  lineup: "A",
  ciudad: "Ciudad de México",
  ciudad_tier: "tier1",
  fecha_inicio: "2026-11-14",
  notas: "",
};

// ─────────────────────────────────────────────────────────────────────────
// Validación
// ─────────────────────────────────────────────────────────────────────────

test("un evento bien formado no produce errores", () => {
  assert.deepEqual(validateEventoCatalogo(EVENTO_OK), {});
});

test("el nombre es obligatorio y los espacios no cuentan como nombre", () => {
  const errores = validateEventoCatalogo({ ...EVENTO_OK, nombre: "   " });
  assert.ok(errores.nombre);
});

test("aforo y días respetan los mismos topes que una cotización", () => {
  assert.ok(validateEventoCatalogo({ ...EVENTO_OK, aforo: 0 }).aforo);
  assert.ok(validateEventoCatalogo({ ...EVENTO_OK, aforo: 500_001 }).aforo);
  assert.ok(validateEventoCatalogo({ ...EVENTO_OK, aforo: 1.5 }).aforo);
  assert.ok(validateEventoCatalogo({ ...EVENTO_OK, dias: 0 }).dias);
  assert.ok(validateEventoCatalogo({ ...EVENTO_OK, dias: 31 }).dias);
});

test("la fecha es opcional, pero si viene tiene que existir de verdad", () => {
  assert.deepEqual(validateEventoCatalogo({ ...EVENTO_OK, fecha_inicio: "" }), {});
  // 2026 no es bisiesto: el 29 de febrero no existe. La expresión regular
  // sola lo aceptaría.
  assert.ok(
    validateEventoCatalogo({ ...EVENTO_OK, fecha_inicio: "2026-02-29" }).fecha_inicio,
  );
  assert.ok(validateEventoCatalogo({ ...EVENTO_OK, fecha_inicio: "14/11/2026" }).fecha_inicio);
  assert.equal(esFechaISOValida("2024-02-29"), true); // 2024 sí es bisiesto
});

// ─────────────────────────────────────────────────────────────────────────
// Entrada no confiable
// ─────────────────────────────────────────────────────────────────────────

test("la allowlist descarta los campos que el cliente no debe poder fijar", () => {
  const parsed = parseEventoCatalogo({
    ...EVENTO_OK,
    id: "00000000-0000-4000-8000-000000000000",
    activo: false,
    creado_por: "otro-usuario",
    creado_en: "1999-01-01",
  });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  // El objeto se construye de cero: los campos de más no sobreviven.
  assert.deepEqual(Object.keys(parsed.evento).sort(), [
    "aforo",
    "ciudad",
    "ciudad_tier",
    "dias",
    "fecha_inicio",
    "lineup",
    "nombre",
    "notas",
  ]);
});

test("rechaza cuerpos que no son objetos", () => {
  for (const basura of [null, "texto", 42, [], undefined]) {
    assert.equal(parseEventoCatalogo(basura).ok, false);
  }
});

test("rechaza enums fuera del catálogo aunque TypeScript diga lo contrario", () => {
  assert.equal(parseEventoCatalogo({ ...EVENTO_OK, lineup: "Z" }).ok, false);
  assert.equal(parseEventoCatalogo({ ...EVENTO_OK, ciudad_tier: "tier9" }).ok, false);
});

test("acepta números que llegan como texto, como los manda un formulario", () => {
  const parsed = parseEventoCatalogo({ ...EVENTO_OK, aforo: "45000", dias: "3" });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.evento.aforo, 45_000);
  assert.equal(parsed.evento.dias, 3);
});

// ─────────────────────────────────────────────────────────────────────────
// Referencia al evento desde la cotización
// ─────────────────────────────────────────────────────────────────────────

const COTIZACION_OK = {
  marca: "Michelob Ultra",
  contacto: "",
  nombre_evento: "Ultra México 2026",
  aforo: 45_000,
  dias: 3,
  lineup: "A",
  exclusiva: true,
  activacion: "oficial",
  ciudad_tier: "tier1",
  tiene_territorio: true,
  territorio_lado: 5,
  paga_con_producto: false,
  monto_producto: 0,
};

test("evento_id solo se acepta si tiene forma de UUID", () => {
  const bueno = parseEventoInput({
    ...COTIZACION_OK,
    evento_id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  });
  assert.equal(bueno.ok, true);
  if (bueno.ok) assert.equal(bueno.evento.evento_id, "3f2504e0-4f89-41d3-9a0c-0305e82c3301");

  // Un id inventado no llega a la consulta: se descarta y la cotización
  // queda como capturada a mano.
  for (const malo of ["1 OR 1=1", "../../etc/passwd", 42, null, {}]) {
    const parsed = parseEventoInput({ ...COTIZACION_OK, evento_id: malo });
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.evento.evento_id, "");
  }
});

test("sin evento_id la cotización sigue siendo válida (captura a mano)", () => {
  const parsed = parseEventoInput(COTIZACION_OK);
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.evento.evento_id, "");
});

// ─────────────────────────────────────────────────────────────────────────
// Autorización — se prueba por PERMISO, nunca por nombre de rol
// ─────────────────────────────────────────────────────────────────────────

test("los permisos de eventos existen en el catálogo", () => {
  for (const p of ["events.view", "events.create", "events.edit", "events.delete"]) {
    assert.ok(
      (PERMISSIONS as readonly string[]).includes(p),
      `Falta ${p} en PERMISSIONS`,
    );
  }
});

test("todo rol puede ver el catálogo: sin eso el selector del cotizador sale vacío", () => {
  for (const role of ROLES) {
    assert.ok(can(ctxFor(role), "events.view"), `${role} debería poder ver eventos`);
  }
});

test("dar de baja un evento no está al alcance de quien solo cotiza", () => {
  assert.equal(can(ctxFor("COMMERCIAL"), "events.create"), false);
  assert.equal(can(ctxFor("COMMERCIAL"), "events.edit"), false);
  assert.equal(can(ctxFor("COMMERCIAL"), "events.delete"), false);
  assert.equal(can(ctxFor("VIEWER"), "events.create"), false);
  assert.equal(can(ctxFor("OPERATIONS"), "events.edit"), false);
  // MANAGER mantiene el catálogo pero no da de baja.
  assert.equal(can(ctxFor("MANAGER"), "events.create"), true);
  assert.equal(can(ctxFor("MANAGER"), "events.delete"), false);
});

test("el módulo de eventos no aparece para quien solo lo consume", () => {
  const item = NAVIGATION.flatMap((s) => s.items).find(
    (i) => i.href === "/admin/eventos",
  );
  assert.ok(item, "El módulo de eventos debería estar registrado en NAVIGATION");
  assert.equal(isNavItemVisible(item, ctxFor("COMMERCIAL")), false);
  assert.equal(isNavItemVisible(item, ctxFor("ADMIN")), true);
});
