ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS trash_moved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trash_delete_after_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS messages_trash_expiry_idx
  ON messages(folder, trash_delete_after_at);
