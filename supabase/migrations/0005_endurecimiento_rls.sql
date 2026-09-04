-- ============================================================================
-- ENDURECIMIENTO DE ROW LEVEL SECURITY
--
-- ESTADO: ESCRITA, NO APLICADA. Correr después de 0001/0002/0003.
-- Es independiente de 0004_rbac.sql: se puede aplicar antes o después.
--
-- Cierra dos huecos reales encontrados en la auditoría de seguridad
-- (SECURITY-AUDIT.md, controles #3, #4, #7 y #8).
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- HUECO 1 — `comparables` era legible por cualquiera en internet
--
-- La política original era:
--     create policy "comparables lectura publica"
--       on comparables for select using (true);
--
-- `using (true)` significa "cualquiera", y la anon key de Supabase es
-- PÚBLICA por diseño: va dentro del bundle de JavaScript que sirve la app.
-- Cualquiera podía sacarla del navegador y pedir la tabla completa a la REST
-- API de Supabase sin iniciar sesión.
--
-- Lo que hay en esa tabla no es catálogo público: son los montos reales de
-- patrocinios cerrados, con marca y evento. Es justo la información
-- comercial que la plataforma existe para proteger.
--
-- Corrección: exigir sesión. La narrativa con IA ya exige `quotes.create`,
-- así que el flujo legítimo sigue funcionando igual.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "comparables lectura publica" on comparables;

create policy "comparables: solo con sesión iniciada"
  on comparables for select
  using (auth.uid() is not null);

comment on table comparables is
  'Montos reales de patrocinios cerrados. Información comercial sensible: la lectura exige sesión iniciada. NO volver a poner using(true).';


-- ─────────────────────────────────────────────────────────────────────────
-- HUECO 2 — el navegador podía escribir cualquier precio
--
-- La política original permitía a un usuario autenticado insertar en
-- `cotizaciones` siempre que `auth.uid() = user_id`. Eso protege contra
-- escribir en el renglón de OTRO usuario, pero no dice nada sobre el
-- CONTENIDO: el cliente mandaba `precio_min`, `precio_objetivo`,
-- `precio_max` y `desglose` directamente.
--
-- O sea que cualquiera con una sesión válida podía guardar una cotización de
-- $9,000,000 con un `curl`, saltándose la fórmula por completo. Toda la
-- propuesta de valor —"el número es defendible porque sale de una fórmula
-- determinista y auditable"— dependía de que nadie lo intentara.
--
-- Corrección: la escritura pasa por POST /api/cotizaciones, que recalcula el
-- precio del lado del servidor. Aquí se revoca el atajo.
--
-- REQUISITO: `SUPABASE_SERVICE_ROLE_KEY` debe estar configurada en Vercel
-- ANTES de aplicar esta parte, o el guardado dejará de funcionar.
-- El rol `service_role` ignora RLS, así que el endpoint sigue escribiendo.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "usuario crea sus propias cotizaciones" on cotizaciones;

revoke insert, update, delete on cotizaciones from authenticated;
revoke all on cotizaciones from anon;

-- La lectura no cambia: cada quien sigue viendo solo las suyas.
-- (La política "usuario ve solo sus cotizaciones" de 0001 se conserva.)
grant select on cotizaciones to authenticated;

comment on table cotizaciones is
  'Escritura solo vía POST /api/cotizaciones, que recalcula el precio server-side. El INSERT directo desde el navegador está revocado a propósito: permitía guardar cualquier precio.';


-- ─────────────────────────────────────────────────────────────────────────
-- Mínimo privilegio sobre `comparables`
--
-- 0001 no creó políticas de escritura, así que RLS ya la negaba. Se revocan
-- además los privilegios de tabla, para que el día que alguien agregue una
-- política de insert por error no baste para escribir.
-- ─────────────────────────────────────────────────────────────────────────

revoke insert, update, delete on comparables from authenticated, anon;
revoke all on comparables from anon;
grant select on comparables to authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- Verificación — correr después de aplicar
--
-- 1) Ninguna tabla del esquema public sin RLS:
--
--    select tablename, rowsecurity from pg_tables
--    where schemaname = 'public' and rowsecurity = false;
--    -- Debe regresar 0 renglones.
--
-- 2) Ninguna política que conceda a todo el mundo:
--
--    select tablename, policyname, cmd, qual from pg_policies
--    where schemaname = 'public' and qual = 'true';
--    -- Debe regresar 0 renglones.
--
-- 3) Sin sesión, `comparables` ya no devuelve datos:
--
--    curl "$SUPABASE_URL/rest/v1/comparables?select=*" -H "apikey: $ANON_KEY"
--    -- Debe regresar [] (no la tabla).
--
-- 4) Con sesión, el INSERT directo se rechaza:
--
--    curl -X POST "$SUPABASE_URL/rest/v1/cotizaciones" \
--      -H "apikey: $ANON_KEY" -H "Authorization: Bearer $USER_JWT" \
--      -H "Content-Type: application/json" \
--      -d '{"user_id":"<tu-uuid>","nombre_evento":"x","aforo":1,"dias":1,
--           "lineup":"C","exclusiva":false,"activacion":"media",
--           "ciudad_tier":"tier3","precio_objetivo":9000000}'
--    -- Debe regresar 401/403, no 201.
-- ─────────────────────────────────────────────────────────────────────────
