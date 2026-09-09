import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  permissionsForRole,
  statusCanSignIn,
  type Permission,
  type RoleName,
} from "./auth/permissions.ts";
import { ANONYMOUS, can, canAll, canAny, hasRole, isAuthenticated } from "./auth/can.ts";
import {
  esUserStatus,
  resolveAuthzContext,
  rolesDeAsignaciones,
} from "./auth/resolveContext.ts";
import { isNavItemVisible, visibleNavigation, NAVIGATION } from "./navigation.ts";

function ctxFor(role: RoleName) {
  return {
    userId: "u1",
    email: "u@ejemplo.mx",
    displayName: "U",
    role,
    roles: [role],
    permissions: permissionsForRole(role),
  };
}

test("todo permiso otorgado por un rol existe en el catálogo", () => {
  const catalogo = new Set<string>(PERMISSIONS);
  for (const role of ROLES) {
    for (const p of ROLE_PERMISSIONS[role]) {
      assert.ok(
        catalogo.has(p),
        `El rol ${role} otorga "${p}", que no está en PERMISSIONS`,
      );
    }
  }
});

test("SUPER_ADMIN tiene todos los permisos del catálogo", () => {
  const sa = ctxFor("SUPER_ADMIN");
  for (const p of PERMISSIONS) {
    assert.ok(can(sa, p), `SUPER_ADMIN debería tener ${p}`);
  }
});

test("el anónimo no tiene ningún permiso", () => {
  assert.equal(isAuthenticated(ANONYMOUS), false);
  for (const p of PERMISSIONS) {
    assert.equal(can(ANONYMOUS, p), false, `El anónimo no debe tener ${p}`);
  }
});

test("un rol comercial no puede administrar usuarios", () => {
  const comercial = ctxFor("COMMERCIAL");
  assert.equal(can(comercial, "quotes.create"), true);
  assert.equal(can(comercial, "users.view"), false);
  assert.equal(can(comercial, "users.create"), false);
  assert.equal(can(comercial, "users.delete"), false);
  assert.equal(can(comercial, "settings.edit"), false);
});

test("VIEWER es estrictamente de lectura", () => {
  const viewer = ctxFor("VIEWER");
  const escrituras = PERMISSIONS.filter(
    (p) => !p.endsWith(".view") && !p.endsWith(".view_all") && !p.endsWith(".export"),
  );
  for (const p of escrituras) {
    assert.equal(can(viewer, p), false, `VIEWER no debería poder ${p}`);
  }
});

test("canAny y canAll se comportan como su nombre indica", () => {
  const ops = ctxFor("OPERATIONS");
  const mixto: Permission[] = ["comparables.edit", "users.delete"];
  assert.equal(canAny(ops, mixto), true);
  assert.equal(canAll(ops, mixto), false);
  assert.equal(canAll(ops, ["comparables.view", "comparables.edit"]), true);
});

test("hasRole solo compara el rol, no concede permisos", () => {
  const admin = ctxFor("ADMIN");
  assert.equal(hasRole(admin, "ADMIN"), true);
  assert.equal(hasRole(admin, "SUPER_ADMIN"), false);
  assert.equal(hasRole(ANONYMOUS, "ADMIN"), false);
});

test("solo ACTIVE puede iniciar sesión", () => {
  assert.equal(statusCanSignIn("ACTIVE"), true);
  assert.equal(statusCanSignIn("INVITED"), false);
  assert.equal(statusCanSignIn("INACTIVE"), false);
  assert.equal(statusCanSignIn("SUSPENDED"), false);
});

test("la navegación esconde Administración a quien no tiene permisos de admin", () => {
  const comercial = ctxFor("COMMERCIAL");
  const secciones = visibleNavigation(comercial);
  const hrefs = secciones.flatMap((s) => s.items.map((i) => i.href));
  assert.ok(hrefs.includes("/"), "El cotizador debe estar visible");
  assert.ok(hrefs.includes("/cotizaciones"), "Sus cotizaciones deben estar visibles");
  assert.ok(
    !hrefs.some((h) => h.startsWith("/admin")),
    "Ningún módulo de administración debe aparecer",
  );
});

test("la navegación muestra Administración a SUPER_ADMIN", () => {
  const hrefs = visibleNavigation(ctxFor("SUPER_ADMIN")).flatMap((s) =>
    s.items.map((i) => i.href),
  );
  assert.ok(hrefs.includes("/admin/usuarios"));
  assert.ok(hrefs.includes("/admin/configuracion"));
});

test("el anónimo solo ve los módulos que no exigen sesión", () => {
  const secciones = visibleNavigation(ANONYMOUS);
  const hrefs = secciones.flatMap((s) => s.items.map((i) => i.href));
  assert.deepEqual(hrefs, ["/"]);
  // Y ninguna sección vacía se queda dibujada
  assert.ok(secciones.every((s) => s.items.length > 0));
});

test("todo item de navegación con permisos declara permisos del catálogo", () => {
  const catalogo = new Set<string>(PERMISSIONS);
  for (const section of NAVIGATION) {
    for (const item of section.items) {
      for (const p of item.permissions ?? []) {
        assert.ok(catalogo.has(p), `"${item.href}" exige "${p}", que no existe`);
      }
      // Sanity: un item de administración nunca debe quedar sin permisos,
      // porque eso lo volvería visible para cualquiera.
      if (item.href.startsWith("/admin")) {
        assert.ok(
          (item.permissions?.length ?? 0) > 0,
          `"${item.href}" es de administración y no declara permisos`,
        );
      }
      assert.equal(isNavItemVisible(item, ANONYMOUS), item.href === "/");
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Varios roles por persona (decisión de producto, 2026-09-09)
// ═══════════════════════════════════════════════════════════════════════

test("dos roles suman sus permisos, sin repetirlos", () => {
  const c = resolveAuthzContext({
    userId: "u-1",
    email: "u@ejemplo.mx",
    displayName: "U",
    roles: ["COMMERCIAL", "OPERATIONS"],
    status: "ACTIVE",
  });

  // Lo suyo de comercial…
  assert.ok(can(c, "quotes.create"));
  // …más lo de operaciones, que comercial no tiene.
  assert.ok(can(c, "comparables.delete"));
  // Y nada que ninguno de los dos conceda.
  assert.equal(can(c, "users.delete"), false);

  assert.equal(new Set(c.permissions).size, c.permissions.length, "sin repetidos");
});

test("el rol que se muestra es el de mayor alcance, pero no decide accesos", () => {
  const c = resolveAuthzContext({
    userId: "u-1",
    email: "u@ejemplo.mx",
    displayName: "U",
    roles: ["VIEWER", "ADMIN", "COMMERCIAL"],
    status: "ACTIVE",
  });
  assert.equal(c.role, "ADMIN", "ADMIN es el de mayor alcance de los tres");
  // El acceso sigue saliendo de la unión, no de esa etiqueta.
  assert.ok(can(c, "quotes.create"));
});

test("hasRole mira todos los roles, no solo el principal", () => {
  const c = resolveAuthzContext({
    userId: "u-1",
    email: "u@ejemplo.mx",
    displayName: "U",
    roles: ["ADMIN", "OPERATIONS"],
    status: "ACTIVE",
  });
  assert.ok(hasRole(c, "OPERATIONS"), "OPERATIONS está asignado aunque no sea el principal");
  assert.equal(hasRole(c, "VIEWER"), false);
});

// ═══════════════════════════════════════════════════════════════════════
// Lectura de roles desde la base
// ═══════════════════════════════════════════════════════════════════════

test("un rol que existe en la base pero no en el catálogo no concede nada", () => {
  const roles = rolesDeAsignaciones([
    { roles: { nombre: "ADMIN" } },
    { roles: { nombre: "DIOS_DEL_SISTEMA" } }, // creado a mano en SQL
    { roles: null },
  ]);
  assert.deepEqual(roles, ["ADMIN"]);
});

test("no se duplican roles repetidos ni importa la forma del embed", () => {
  const roles = rolesDeAsignaciones([
    { roles: [{ nombre: "VIEWER" }, { nombre: "VIEWER" }] },
    { roles: { nombre: "VIEWER" } },
  ]);
  assert.deepEqual(roles, ["VIEWER"]);
});

test("un status desconocido no se trata como activo", () => {
  assert.equal(esUserStatus("ACTIVE"), true);
  for (const basura of ["activo", "", "ADMIN", null, 1]) {
    assert.equal(esUserStatus(basura), false, `${String(basura)} no es un status válido`);
  }
});
