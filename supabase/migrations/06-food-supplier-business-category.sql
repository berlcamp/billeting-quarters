-- Replace cuisine_type and capacity_meals_per_day on food_suppliers
-- with a single business_category text column.

ALTER TABLE palaro.food_suppliers
  ADD COLUMN IF NOT EXISTS business_category TEXT;

UPDATE palaro.food_suppliers
SET business_category = COALESCE(business_category, cuisine_type)
WHERE business_category IS NULL;

ALTER TABLE palaro.food_suppliers
  DROP COLUMN IF EXISTS cuisine_type,
  DROP COLUMN IF EXISTS capacity_meals_per_day;
