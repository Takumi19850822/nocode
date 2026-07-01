-- 010: フィールドの行区切り（自由配置）と集計/グラフ機能
-- Supabase SQL Editor で 009 までの適用後に実行してください。

-- =========================================================
-- 1. フィールドの行区切り（このフィールドから新しい行にする）
-- =========================================================
ALTER TABLE app_fields
  ADD COLUMN IF NOT EXISTS break_before BOOLEAN NOT NULL DEFAULT false;

-- =========================================================
-- 2. 集計定義（アプリごとの集計/グラフ）
-- =========================================================
CREATE TABLE IF NOT EXISTS app_aggregations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_aggregations_app ON app_aggregations(app_id);

DROP TRIGGER IF EXISTS trg_app_aggregations_updated ON app_aggregations;
CREATE TRIGGER trg_app_aggregations_updated
  BEFORE UPDATE ON app_aggregations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =========================================================
-- 3. RLS（app_fields と同じ考え方: 在籍テナントは閲覧、tenant_admin は管理）
-- =========================================================
ALTER TABLE app_aggregations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all_aggregations" ON app_aggregations;
CREATE POLICY "super_admin_all_aggregations" ON app_aggregations
  FOR ALL USING (get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "tenant_users_read_aggregations" ON app_aggregations;
CREATE POLICY "tenant_users_read_aggregations" ON app_aggregations
  FOR SELECT USING (
    app_id IN (SELECT id FROM apps WHERE tenant_id = get_user_tenant_id())
  );

DROP POLICY IF EXISTS "tenant_admin_manage_aggregations" ON app_aggregations;
CREATE POLICY "tenant_admin_manage_aggregations" ON app_aggregations
  FOR ALL USING (
    app_id IN (SELECT id FROM apps WHERE tenant_id = get_user_tenant_id())
    AND get_active_tenant_role() = 'tenant_admin'
  );
