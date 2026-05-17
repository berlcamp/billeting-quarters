-- 32-food-requests-delegation.sql
-- Food requests are now filed against a delegation, not a billeting
-- quarter. A delegation already knows its assigned BQ, and command
-- center reasoning ("which delegation needs feeding") matches the
-- supplier ↔ delegation roster directly. The bq_id column is dropped
-- after backfilling delegation_id from delegations.assigned_bq_id.

ALTER TABLE palaro.food_requests
  ADD COLUMN IF NOT EXISTS delegation_id UUID REFERENCES palaro.delegations(id) ON DELETE RESTRICT;

-- Backfill: for each existing request, pick any active delegation
-- currently assigned to that BQ. Multiple delegations can share a BQ,
-- so DISTINCT ON keeps it deterministic without erroring on duplicates.
UPDATE palaro.food_requests fr
SET delegation_id = sub.delegation_id
FROM (
  SELECT DISTINCT ON (d.assigned_bq_id)
    d.assigned_bq_id AS bq_id,
    d.id AS delegation_id
  FROM palaro.delegations d
  WHERE d.assigned_bq_id IS NOT NULL
    AND d.is_active = TRUE
  ORDER BY d.assigned_bq_id, d.region_code
) sub
WHERE fr.bq_id = sub.bq_id
  AND fr.delegation_id IS NULL;

-- Drop bq_id outright — the form no longer asks for it and downstream
-- consumers (dashboard, table) will read delegation_id instead.
ALTER TABLE palaro.food_requests
  DROP COLUMN IF EXISTS bq_id;

ALTER TABLE palaro.food_requests
  ALTER COLUMN delegation_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_food_requests_delegation_id
  ON palaro.food_requests(delegation_id);

COMMENT ON COLUMN palaro.food_requests.delegation_id IS
  'Delegation that filed (or is the beneficiary of) this food request. Replaces the prior bq_id linkage; BQ can be derived via delegations.assigned_bq_id when needed.';
