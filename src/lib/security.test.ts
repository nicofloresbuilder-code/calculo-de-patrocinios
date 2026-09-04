import { test } from "node:test";
import assert from "node:assert/strict";
import { PERMISSIONS, ROLES, permissionsForRole, type RoleName } from "./auth/permissions.ts";
import { ANONYMOUS, can, type AuthzContext } from "./auth/can.ts";
import { resolveAuthzContext } from "./auth/resolveContext.ts";
import { parseEventoInput } from "./validation/parseEvento.ts";
import { checkRateLimit } from "./rateLimit.ts";
import { computePrice } from "./pricing.ts";
import { NAVIGATION } from "./navigation.ts";

// ═══════════════════════════════════════════════════════════════════════
// Escenario: usuario NO autorizado recibe 403
// ═══════════════════════════════════════════════════════════════════════

function ctx(role: RoleName): AuthzContext {
  return resolveAuthzContext({
    userId: "u-1",
    email: "u@ejemplo.mx",
    displayName: "U",
    role,
    status: "ACTIVE",
  });
}

/** Simula la decisión de `requirePermission()` sin levantar un servidor. */
function statusDeRequirePermission(c: AuthzContext, permiso: (typeof PERMISSIONS)[number]) {
  if (!c.userId) return 401;
  return can(c, permiso) ? 200 : 403;
}

test("un usuario sin el permiso recibe 403, no 200", () => {
  assert.equal(statusDeRequirePermission(ctx("COMMERCIAL"), "users.delete"), 403);
  assert.equal(statusDeRequirePermission(ctx("VIEWER"), "quotes.create"), 403);
  assert.equal(statusDeRequirePermission(ctx("OPERATIONS"), "settings.edit"), 403);
});

test("un anónimo recibe 401 antes que 403", () => {
  assert.equal(statusDeRequirePermission(ANONYMOUS, "quotes.view"), 401);
});

test("un usuario autorizado sí pasa", () => {
  assert.equal(statusDeRequirePermission(ctx("ADMIN"), "users.delete"), 200);
  assert.equal(statusDeRequirePermission(ctx("COMMERCIAL"), "quotes.create"), 200);
});

// ═══════════════════════════════════════════════════════════════════════
// Escenario: sesión de usuario DESACTIVADO
// ═══════════════════════════════════════════════════════════════════════

test("una cuenta desactivada pierde todos sus permisos aunque la sesión siga viva", () => {
  for (const status of ["INACTIVE", "SUSPENDED", "INVITED"] as const) {
    const c = resolveAuthzContext({
      userId: "u-1",
      email: "admin@ejemplo.mx",
      displayName: "Admin",
      role: "SUPER_ADMIN", // el rol más alto
      status,
    });
    assert.equal(c.userId, null, `${status} no debe conservar identidad autorizada`);
    assert.deepEqual(c.permissions, [], `${status} no debe conservar permisos`);
    assert.equal(statusDeRequirePermission(c, "users.delete"), 401);
  }
});

test("solo ACTIVE conserva los permisos de su rol", () => {
  const c = resolveAuthzContext({
    userId: "u-1", email: "a@b.mx", displayName: "A",
    role: "ADMIN", status: "ACTIVE",
  });
  assert.equal(c.role, "ADMIN");
  assert.ok(can(c, "users.view"));
});

// ═══════════════════════════════════════════════════════════════════════
// Escenario: DENY BY DEFAULT / mínimo privilegio
// ═══════════════════════════════════════════════════════════════════════

test("un usuario sin rol asignado no recibe ningún acceso implícito", () => {
  const c = resolveAuthzContext({
    userId: "u-nuevo", email: "nuevo@ejemplo.mx", displayName: "Nuevo",
    role: null, status: "ACTIVE",
  });
  assert.deepEqual(c.permissions, []);
  for (const p of PERMISSIONS) assert.equal(can(c, p), false);
});

test("una entrada incompleta colapsa a anónimo, nunca a permisivo", () => {
  const casos = [
    { userId: null, role: "SUPER_ADMIN" as const, status: "ACTIVE" as const },
    { userId: "u", role: "SUPER_ADMIN" as const, status: null },
    { userId: "u", role: null, status: "ACTIVE" as const },
  ];
  for (const caso of casos) {
    const c = resolveAuthzContext({ email: null, displayName: null, ...caso });
    assert.deepEqual(c.permissions, []);
  }
});

test("ningún rol concede un permiso fuera del catálogo", () => {
  const catalogo = new Set<string>(PERMISSIONS);
  for (const role of ROLES) {
    for (const p of permissionsForRole(role)) assert.ok(catalogo.has(p));
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Escenario: ESCALAMIENTO DE ROL
// ═══════════════════════════════════════════════════════════════════════

test("el rol se toma del perfil del servidor, no de lo que mande el cliente", () => {
  // Un atacante manda {"role":"SUPER_ADMIN"} en el cuerpo. El contexto se
  // construye solo desde el perfil, así que ese campo no tiene por dónde
  // entrar: resolveAuthzContext no acepta datos del cliente.
  const perfilDelServidor = {
    userId: "u-1", email: "atacante@ejemplo.mx", displayName: "A",
    role: "VIEWER" as const, status: "ACTIVE" as const,
  };
  const cuerpoMalicioso = { role: "SUPER_ADMIN", isAdmin: true, permissions: PERMISSIONS };
  const c = resolveAuthzContext(perfilDelServidor);

  assert.equal(c.role, "VIEWER");
  assert.equal(can(c, "users.assign_role"), false);
  assert.ok(!("isAdmin" in c));
  // El cuerpo no influye en nada
  assert.notDeepEqual(c.permissions, cuerpoMalicioso.permissions);
});

test("asignar roles exige users.assign_role, que ningún rol no-admin tiene", () => {
  for (const role of ["COMMERCIAL", "OPERATIONS", "VIEWER", "MANAGER"] as const) {
    assert.equal(can(ctx(role), "users.assign_role"), false, `${role} no debe poder asignar roles`);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Escenario: FIELD TAMPERING (allowlist de campos)
// ═══════════════════════════════════════════════════════════════════════

const EVENTO_VALIDO = {
  nombre_evento: "Evento de prueba",
  aforo: 15000,
  dias: 2,
  lineup: "B",
  exclusiva: true,
  activacion: "oficial",
  ciudad_tier: "tier1",
  territorio_lado: 5,
  paga_con_producto: false,
  monto_producto: 0,
};

test("los campos protegidos que manda el cliente se descartan", () => {
  const malicioso = {
    ...EVENTO_VALIDO,
    user_id: "otro-usuario",
    created_by: "otro-usuario",
    role: "SUPER_ADMIN",
    isAdmin: true,
    precio_objetivo: 9_000_000,
    precio_min: 9_000_000,
    precio_max: 9_000_000,
    desglose: { aforo: 100 },
  };
  const r = parseEventoInput(malicioso);
  assert.ok(r.ok);
  if (!r.ok) return;

  for (const campo of ["user_id", "created_by", "role", "isAdmin", "precio_objetivo", "desglose"]) {
    assert.ok(!(campo in r.evento), `"${campo}" no debe sobrevivir al parseo`);
  }
  assert.deepEqual(Object.keys(r.evento).sort(), Object.keys(EVENTO_VALIDO).sort());
});

test("el precio lo decide el servidor: el que mande el cliente es irrelevante", () => {
  const r = parseEventoInput({ ...EVENTO_VALIDO, precio_objetivo: 9_000_000 });
  assert.ok(r.ok);
  if (!r.ok) return;
  const precioServidor = computePrice(r.evento);
  assert.notEqual(precioServidor.objetivo, 9_000_000);
  // Y es reproducible: mismas variables ⇒ mismo precio
  assert.equal(computePrice(r.evento).objetivo, precioServidor.objetivo);
});

// ═══════════════════════════════════════════════════════════════════════
// Escenario: VALIDACIÓN DE ENTRADA NO CONFIABLE
// ═══════════════════════════════════════════════════════════════════════

test("rechaza cuerpos que no son objetos", () => {
  for (const basura of [null, undefined, 42, "texto", [], true]) {
    assert.equal(parseEventoInput(basura).ok, false, `${JSON.stringify(basura)} debe rechazarse`);
  }
});

test("rechaza enums fuera del catálogo (no confía en el tipo de TypeScript)", () => {
  assert.equal(parseEventoInput({ ...EVENTO_VALIDO, lineup: "Z" }).ok, false);
  assert.equal(parseEventoInput({ ...EVENTO_VALIDO, activacion: "'; drop table--" }).ok, false);
  assert.equal(parseEventoInput({ ...EVENTO_VALIDO, ciudad_tier: { $ne: null } }).ok, false);
});

test("rechaza números fuera de rango y valores no numéricos", () => {
  assert.equal(parseEventoInput({ ...EVENTO_VALIDO, aforo: -1 }).ok, false);
  assert.equal(parseEventoInput({ ...EVENTO_VALIDO, aforo: 999_999_999 }).ok, false);
  assert.equal(parseEventoInput({ ...EVENTO_VALIDO, aforo: "no soy número" }).ok, false);
  assert.equal(parseEventoInput({ ...EVENTO_VALIDO, aforo: [1, 2] }).ok, false);
  assert.equal(parseEventoInput({ ...EVENTO_VALIDO, dias: 1e9 }).ok, false);
  assert.equal(parseEventoInput({ ...EVENTO_VALIDO, territorio_lado: 1000 }).ok, false);
});

test("acepta números que llegan como texto (JSON de un formulario)", () => {
  const r = parseEventoInput({ ...EVENTO_VALIDO, aforo: "15000", dias: "2" });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.evento.aforo, 15000);
  assert.equal(typeof r.evento.aforo, "number");
});

test("un nombre con carga de XSS se conserva como texto, no se ejecuta", () => {
  // No se sanitiza aquí a propósito: React escapa al renderizar. Lo que
  // importa es que se guarde como texto y nunca como HTML.
  const payload = '<img src=x onerror="alert(1)">';
  const r = parseEventoInput({ ...EVENTO_VALIDO, nombre_evento: payload });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.evento.nombre_evento, payload);
  assert.equal(typeof r.evento.nombre_evento, "string");
});

test("el nombre se recorta y no acepta longitudes abusivas", () => {
  assert.equal(parseEventoInput({ ...EVENTO_VALIDO, nombre_evento: "   " }).ok, false);
  assert.equal(parseEventoInput({ ...EVENTO_VALIDO, nombre_evento: "x".repeat(5000) }).ok, false);
});

// ═══════════════════════════════════════════════════════════════════════
// Escenario: RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════

test("el rate limit corta al superar el límite y no bloquea para siempre", () => {
  const clave = `test-${Math.random()}`;
  for (let i = 0; i < 3; i++) {
    assert.equal(checkRateLimit(clave, 3, 60_000).permitido, true, `intento ${i + 1}`);
  }
  const cortado = checkRateLimit(clave, 3, 60_000);
  assert.equal(cortado.permitido, false);
  assert.ok(cortado.reintentarEn > 0, "debe decir cuándo reintentar");
  assert.ok(cortado.reintentarEn <= 60, "el bloqueo no puede ser permanente");
});

test("cada solicitante tiene su propio presupuesto", () => {
  const a = `a-${Math.random()}`;
  const b = `b-${Math.random()}`;
  checkRateLimit(a, 1, 60_000);
  assert.equal(checkRateLimit(a, 1, 60_000).permitido, false);
  assert.equal(checkRateLimit(b, 1, 60_000).permitido, true, "b no debe pagar por a");
});

test("la ventana expira y el solicitante se recupera", async () => {
  const clave = `exp-${Math.random()}`;
  checkRateLimit(clave, 1, 30);
  assert.equal(checkRateLimit(clave, 1, 30).permitido, false);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(checkRateLimit(clave, 1, 30).permitido, true);
});

// ═══════════════════════════════════════════════════════════════════════
// Escenario: ENDPOINT OCULTO EN EL FRONTEND
// ═══════════════════════════════════════════════════════════════════════

test("esconder el módulo en la navegación no concede ni niega acceso por sí solo", () => {
  const viewer = ctx("VIEWER");
  const itemsAdmin = NAVIGATION.flatMap((s) => s.items).filter((i) =>
    i.href.startsWith("/admin"),
  );
  assert.ok(itemsAdmin.length > 0, "debe haber módulos de administración que probar");

  for (const item of itemsAdmin) {
    // La UI lo esconde…
    const visible = (item.permissions ?? []).some((p) => can(viewer, p));
    assert.equal(visible, false);
    // …y el servidor también lo niega si se llama la ruta directamente.
    for (const p of item.permissions ?? []) {
      assert.equal(statusDeRequirePermission(viewer, p), 403);
    }
  }
});

test("toda ruta /admin declara permisos: ninguna queda pública por olvido", () => {
  for (const section of NAVIGATION) {
    for (const item of section.items) {
      if (!item.href.startsWith("/admin")) continue;
      assert.ok(
        (item.permissions?.length ?? 0) > 0,
        `"${item.href}" quedaría accesible para cualquiera`,
      );
    }
  }
});
