-- Add fit (1-5 rating) and fund_size columns to investors table
-- Run this in your Supabase SQL editor after 001_initial_schema.sql

ALTER TABLE investors ADD COLUMN IF NOT EXISTS fit INTEGER DEFAULT NULL;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS fund_size TEXT DEFAULT '';

-- Add constraint to ensure fit is between 1 and 5 (or null)
ALTER TABLE investors ADD CONSTRAINT fit_range CHECK (fit IS NULL OR (fit >= 1 AND fit <= 5));
