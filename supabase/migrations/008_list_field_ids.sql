-- アプリごとのレコード一覧表示フィールド
ALTER TABLE apps
  ADD COLUMN IF NOT EXISTS list_field_ids UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN apps.list_field_ids IS
  'レコード一覧に表示するフィールドID（表示順）';
