-- Add custom_fields JSONB column to investors table for dynamic columns
-- Run this in your Supabase SQL editor after 002_add_fit_and_fund_size.sql

ALTER TABLE investors ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Add index for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_investors_custom_fields ON investors USING gin(custom_fields);
