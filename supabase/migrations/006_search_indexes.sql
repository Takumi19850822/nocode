-- 検索・一覧パフォーマンス向上用インデックス
-- Supabase SQL Editor で 005 の後に実行

-- 部分一致検索（ILIKE '%...%'）用
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- レコード一覧: アプリ別・新しい順
CREATE INDEX IF NOT EXISTS idx_app_records_app_created
  ON app_records (app_id, created_at DESC);

-- テナント単位でのアプリ別レコード絞り込み
CREATE INDEX IF NOT EXISTS idx_app_records_tenant_app
  ON app_records (tenant_id, app_id);

-- 検索フィールド: field_id 絞り込み + 完全一致・前方一致
CREATE INDEX IF NOT EXISTS idx_record_values_field_value
  ON app_record_values (field_id, value);

-- 検索フィールド: 部分一致（ILIKE '%キーワード%'）
-- field_id インデックスと組み合わせて Bitmap Index Scan される
CREATE INDEX IF NOT EXISTS idx_record_values_value_trgm
  ON app_record_values USING gin (value gin_trgm_ops);
