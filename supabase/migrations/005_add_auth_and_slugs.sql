-- Migration: Add authentication and semantic URLs support
-- This enables hybrid auth model: login required to create, but shareable links work anonymously

-- Step 1: Add user_id and slug columns to lists table
ALTER TABLE lists
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_slug ON lists(slug);

-- Step 3: Enable Row Level Security (RLS)
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE investors ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view lists" ON lists;
DROP POLICY IF EXISTS "Anyone can update lists" ON lists;
DROP POLICY IF EXISTS "Authenticated users can create lists" ON lists;
DROP POLICY IF EXISTS "Owners can delete lists" ON lists;
DROP POLICY IF EXISTS "Anyone can view investors" ON investors;
DROP POLICY IF EXISTS "Anyone can modify investors" ON investors;

-- Step 5: Create RLS policies for lists table
-- Policy: Anyone can view any list (via shareable link)
CREATE POLICY "Anyone can view lists" ON lists
  FOR SELECT USING (true);

-- Policy: Anyone can update any list (via shareable link)
CREATE POLICY "Anyone can update lists" ON lists
  FOR UPDATE USING (true);

-- Policy: Only authenticated users can create lists
CREATE POLICY "Authenticated users can create lists" ON lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Only list owner can delete
CREATE POLICY "Owners can delete lists" ON lists
  FOR DELETE USING (auth.uid() = user_id);

-- Step 6: Create RLS policies for investors table
-- Policy: Anyone can view investors from any list
CREATE POLICY "Anyone can view investors" ON investors
  FOR SELECT USING (true);

-- Policy: Anyone can insert investors into any list
CREATE POLICY "Anyone can insert investors" ON investors
  FOR INSERT WITH CHECK (true);

-- Policy: Anyone can update investors in any list
CREATE POLICY "Anyone can update investors" ON investors
  FOR UPDATE USING (true);

-- Policy: Anyone can delete investors from any list
CREATE POLICY "Anyone can delete investors" ON investors
  FOR DELETE USING (true);

-- Step 7: Add metadata columns for better tracking
ALTER TABLE lists
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 8: Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create trigger to auto-update updated_at on lists
DROP TRIGGER IF EXISTS update_lists_updated_at ON lists;
CREATE TRIGGER update_lists_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 10: Backfill existing lists with placeholder data (optional, for testing)
-- Note: In production, you may want to assign existing lists to a specific user
-- For now, we'll leave user_id as NULL for existing lists (they won't appear in dashboard but links still work)
