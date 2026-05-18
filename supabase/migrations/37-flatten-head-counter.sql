-- 37-flatten-head-counter.sql
-- Flattens palaro.head_counter_cells: removes the per-delegate row breakdown
-- (DELEGATION + Delegate 1..9) and collapses everything to a single Type ×
-- Direction entry per delegation per day. Existing per-delegate rows are
-- summed into the previous "DELEGATION" (row_index = 0) row before the
-- column is dropped.

BEGIN;

-- 1. Collapse per-delegate rows into row 0 for each (delegation, date,
--    direction, role) before dropping the column.
-- Pick the most recent (updated_at, updated_by) for the group as the
-- representative attribution. Postgres has no MAX(uuid), so we use the
-- array_agg-with-ORDER-BY trick to grab the latest row's updated_by.
INSERT INTO palaro.head_counter_cells
  (delegation_id, count_date, direction, row_index, role, count,
   updated_by, updated_at)
SELECT
  delegation_id,
  count_date,
  direction,
  0           AS row_index,
  role,
  SUM(count)  AS count,
  (array_agg(updated_by ORDER BY updated_at DESC NULLS LAST))[1] AS updated_by,
  MAX(updated_at) AS updated_at
FROM palaro.head_counter_cells
WHERE row_index > 0
GROUP BY delegation_id, count_date, direction, role
ON CONFLICT (delegation_id, count_date, direction, row_index, role)
DO UPDATE SET
  count      = palaro.head_counter_cells.count + EXCLUDED.count,
  updated_at = GREATEST(palaro.head_counter_cells.updated_at, EXCLUDED.updated_at);

DELETE FROM palaro.head_counter_cells WHERE row_index > 0;

-- 2. Drop the old uniqueness constraint (its auto-generated name includes
--    row_index), recreate without row_index, then drop the column.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'palaro.head_counter_cells'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) LIKE '%row_index%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE palaro.head_counter_cells DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE palaro.head_counter_cells
  DROP COLUMN IF EXISTS row_index;

ALTER TABLE palaro.head_counter_cells
  ADD CONSTRAINT head_counter_cells_delegation_date_direction_role_key
  UNIQUE (delegation_id, count_date, direction, role);

COMMENT ON TABLE palaro.head_counter_cells IS
  'One row per (delegation, count_date, direction, role) — the BQ Head encodes a single Type/Count entry per direction per day. Cells are deleted (not written as 0) when blanked.';

COMMIT;
