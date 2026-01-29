-- Folders and Worksheet Titles Migration
-- Adds folder organization and custom titles for worksheets

-- 1. Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366f1',
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 2. Create indexes for folders
CREATE INDEX IF NOT EXISTS folders_user_id_idx ON folders(user_id);
CREATE INDEX IF NOT EXISTS folders_parent_id_idx ON folders(parent_id);
CREATE INDEX IF NOT EXISTS folders_deleted_at_idx ON folders(deleted_at);

-- 3. Add folder_id and title columns to worksheets
ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS title VARCHAR(200);

-- 4. Create index for folder_id in worksheets
CREATE INDEX IF NOT EXISTS worksheets_folder_id_idx ON worksheets(folder_id);
