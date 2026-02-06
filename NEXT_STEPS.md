# Next Steps - Dynamic Columns Implementation

## ⚠️ IMPORTANT: Run Database Migration First!

Before testing the new dynamic columns feature, you **MUST** run the database migration:

### Step 1: Run Migration in Supabase

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy and paste this SQL:

```sql
-- Migration 003: Add custom_fields for dynamic columns
ALTER TABLE investors ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_investors_custom_fields ON investors USING gin(custom_fields);

-- Migration 004: Add column_order to persist column ordering
ALTER TABLE lists ADD COLUMN IF NOT EXISTS column_order TEXT[] DEFAULT NULL;
COMMENT ON COLUMN lists.column_order IS 'Array of column keys in display order. NULL means use default order.';
```

4. Click "Run" to execute

### Step 2: Test the Features

The app is already running at http://localhost:3000

#### Test CSV Import:
1. Go to http://localhost:3000/export
2. Drop a CSV file or click to browse
3. You'll see checkboxes for each column
4. Select the Status column from the dropdown
5. Check/uncheck columns you want to import
6. Name your pipeline and click Import

#### Test Attio Import:
1. Go to http://localhost:3000/export
2. Select an Attio list
3. You'll see checkboxes for all Attio columns
4. Select the Status column from the dropdown
5. Check/uncheck columns you want to import
6. Name your pipeline and click Import

#### Test Traditional Mode:
1. Go to http://localhost:3000/export
2. Create an empty pipeline
3. Should show traditional fixed columns

## What Changed?

✅ Checkbox selection instead of dropdown mapping
✅ Dynamic columns from imports displayed in the list view
✅ Status column selector (separate from other columns)
✅ Title Case column names
✅ Backward compatibility with traditional columns

## Need Help?

See `MIGRATION_NOTES.md` for complete implementation details and architecture notes.
