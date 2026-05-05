-- Convert food_requests from meal-shaped (meal_type + quantity_meals)
-- to item-shaped (item_name + unit + quantity).
--
-- Strategy: add new columns, backfill from old, then drop the legacy columns.
-- meal_type is mapped into notes so the historical info is preserved.

ALTER TABLE palaro.food_requests
  ADD COLUMN IF NOT EXISTS item_name TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 2);

UPDATE palaro.food_requests
SET
  item_name = COALESCE(item_name, INITCAP(COALESCE(meal_type, 'Meal'))),
  unit = COALESCE(unit, 'meals'),
  quantity = COALESCE(quantity, quantity_meals)
WHERE item_name IS NULL OR unit IS NULL OR quantity IS NULL;

ALTER TABLE palaro.food_requests
  ALTER COLUMN item_name SET NOT NULL,
  ALTER COLUMN unit SET NOT NULL,
  ALTER COLUMN quantity SET NOT NULL;

ALTER TABLE palaro.food_requests
  DROP COLUMN IF EXISTS meal_type,
  DROP COLUMN IF EXISTS quantity_meals;
