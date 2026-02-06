-- Add column_order to lists table to persist column ordering
-- Run this in your Supabase SQL editor after 003_add_custom_fields_jsonb.sql

ALTER TABLE lists ADD COLUMN IF NOT EXISTS column_order TEXT[] DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN lists.column_order IS 'Array of column keys in display order. NULL means use default order.';
