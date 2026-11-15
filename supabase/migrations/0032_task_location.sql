-- 0032: Shoot location — a Google Maps / Waze link or an address, shown as
-- "Open in Google Maps / Waze" on the task. Existing task policies cover it.

ALTER TABLE tasks
  ADD COLUMN location TEXT CHECK (char_length(location) <= 2000);
