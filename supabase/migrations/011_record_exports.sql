-- 011: レコード Excel エクスポート履歴
-- Supabase SQL Editor で 010 までの適用後に実行してください。
-- Storage バケット「record-exports」も作成します（非公開）。

-- =========================================================
-- 1. エクスポート履歴テーブル
-- =========================================================
CREATE TABLE IF NOT EXISTS app_record_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  field_ids JSONB NOT NULL DEFAULT '[]',
  include_created_at BOOLEAN NOT NULL DEFAULT true,
  include_updated_at BOOLEAN NOT NULL DEFAULT false,
  file_name TEXT NOT NULL,
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  row_count INT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_record_exports_app ON app_record_exports(app_id);
CREATE INDEX IF NOT EXISTS idx_app_record_exports_tenant ON app_record_exports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_app_record_exports_created ON app_record_exports(created_at DESC);

DROP TRIGGER IF EXISTS trg_app_record_exports_updated ON app_record_exports;
CREATE TRIGGER trg_app_record_exports_updated
  BEFORE UPDATE ON app_record_exports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =========================================================
-- 2. RLS
-- =========================================================
ALTER TABLE app_record_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all_record_exports" ON app_record_exports;
CREATE POLICY "super_admin_all_record_exports" ON app_record_exports
  FOR ALL USING (get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "tenant_users_read_record_exports" ON app_record_exports;
CREATE POLICY "tenant_users_read_record_exports" ON app_record_exports
  FOR SELECT USING (
    tenant_id = get_user_tenant_id()
    AND app_id IN (SELECT id FROM apps WHERE tenant_id = get_user_tenant_id())
  );

DROP POLICY IF EXISTS "tenant_users_insert_record_exports" ON app_record_exports;
CREATE POLICY "tenant_users_insert_record_exports" ON app_record_exports
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND app_id IN (SELECT id FROM apps WHERE tenant_id = get_user_tenant_id())
  );

DROP POLICY IF EXISTS "tenant_users_update_record_exports" ON app_record_exports;
CREATE POLICY "tenant_users_update_record_exports" ON app_record_exports
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id()
    AND app_id IN (SELECT id FROM apps WHERE tenant_id = get_user_tenant_id())
  );

DROP POLICY IF EXISTS "tenant_admin_delete_record_exports" ON app_record_exports;
CREATE POLICY "tenant_admin_delete_record_exports" ON app_record_exports
  FOR DELETE USING (
    tenant_id = get_user_tenant_id()
    AND get_active_tenant_role() = 'tenant_admin'
  );

-- =========================================================
-- 3. Storage バケット（API 経由で admin アップロード）
-- =========================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'record-exports',
  'record-exports',
  false,
  52428800,
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;
