-- Make lot_id nullable in sales table to allow sales without inventory
ALTER TABLE sales ALTER COLUMN lot_id DROP NOT NULL;