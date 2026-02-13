-- Make price_per_kg nullable in lots table since it will be set during sales
ALTER TABLE public.lots ALTER COLUMN price_per_kg DROP NOT NULL;