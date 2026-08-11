-- =============================================================
-- 0024: One coherent stage colour scheme
--
-- Every stage gets a unique colour so the calendar legend is unambiguous:
--   * each department owns a hue family (Video indigo/violet, Photo pink/rose,
--     PR amber/yellow, Creatives cyan) so you can tell the department at a glance
--   * within a family the ramp goes dark -> light by stage position
--   * terminal stages stay in the green range (the universal "done" signal) but
--     each department gets its own shade, so a delivered video is
--     distinguishable from a delivered photo.
--
-- Matched on (department slug, position) so renamed stages still get coloured.
-- =============================================================

UPDATE department_stages ds
SET color = c.color
FROM (VALUES
  ('video',     1, '#6366f1'),  -- indigo-500
  ('video',     2, '#8b5cf6'),  -- violet-500
  ('video',     3, '#a78bfa'),  -- violet-400
  ('video',     4, '#22c55e'),  -- green-500
  ('photo',     1, '#db2777'),  -- pink-600
  ('photo',     2, '#ec4899'),  -- pink-500
  ('photo',     3, '#f472b6'),  -- pink-400
  ('photo',     4, '#10b981'),  -- emerald-500
  ('pr',        1, '#d97706'),  -- amber-600
  ('pr',        2, '#f59e0b'),  -- amber-500
  ('pr',        3, '#fbbf24'),  -- amber-400
  ('pr',        4, '#84cc16'),  -- lime-500
  ('creatives', 1, '#0891b2'),  -- cyan-600
  ('creatives', 2, '#06b6d4'),  -- cyan-500
  ('creatives', 3, '#22d3ee'),  -- cyan-400
  ('creatives', 4, '#14b8a6')   -- teal-500
) AS c(slug, position, color)
WHERE ds.position = c.position
  AND ds.department_id = (SELECT id FROM departments WHERE slug = c.slug);
