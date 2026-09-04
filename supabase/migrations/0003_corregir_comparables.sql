-- Corrige los montos de los comparables.
--
-- Los tres montos del seed original (0001_init.sql) eran PLACEHOLDER — el
-- propio comentario del archivo lo advertía. En el pase mecánico (Commit 7)
-- Nicolás confirmó las cifras reales y se usaron para recalibrar la
-- fórmula... pero nunca se escribieron de vuelta a la tabla.
--
-- O sea que la fórmula quedó calibrada con los números buenos mientras la
-- tabla que la IA cita como "comparables históricos" seguía con los malos:
--
--   Ultra México 2026   seed $1,200,000  ->  real $5,000,000   (-76%)
--   Goleiro FanFest     seed   $650,000  ->  real $1,000,000   (-35%)
--   Match Cup           seed   $300,000  ->  real   $300,000   (correcto)
--
-- Con Ultra 4x por debajo de su valor real, la narrativa podía estar
-- citando ese deal para justificar cotizaciones bajas.

update comparables set monto_mxn = 5000000 where nombre = 'Ultra Mexico 2026';
update comparables set monto_mxn = 1000000 where nombre = 'Goleiro FanFest';

-- Nota sobre Goleiro: Nicolás lo marcó como deal SUBVALUADO — cerró en $1M
-- cuando el modelo lo valúa en ~$2.3M, y decidió que de ahí en adelante no
-- se dan esos descuentos. Se corrige el monto (es el hecho histórico) pero
-- queda pendiente decidir si debe seguir sirviendo como comparable para la
-- IA, porque citarlo empuja las cotizaciones hacia abajo. Ver DECISIONS.md.
