-- 検索フィールドによるレコード間参照を追跡
ALTER TABLE app_record_values
  ADD COLUMN IF NOT EXISTS referenced_record_id UUID
  REFERENCES app_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_record_values_referenced_record
  ON app_record_values(referenced_record_id)
  WHERE referenced_record_id IS NOT NULL;

COMMENT ON COLUMN app_record_values.referenced_record_id IS
  '検索フィールドで選択した参照元レコードID。削除時に参照元の値をクリアするために使用';
