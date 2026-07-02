-- 012: レコード一覧ビュー（テーブル / カレンダー / カンバン）
-- Supabase SQL Editor で 011 までの適用後に実行してください。

CREATE TABLE IF NOT EXISTS app_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_views_app ON app_views(app_id);

DROP TRIGGER IF EXISTS trg_app_views_updated ON app_views;
CREATE TRIGGER trg_app_views_updated
  BEFORE UPDATE ON app_views
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE app_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all_views" ON app_views;
CREATE POLICY "super_admin_all_views" ON app_views
  FOR ALL USING (get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "tenant_users_read_views" ON app_views;
CREATE POLICY "tenant_users_read_views" ON app_views
  FOR SELECT USING (
    app_id IN (SELECT id FROM apps WHERE tenant_id = get_user_tenant_id())
  );

DROP POLICY IF EXISTS "tenant_admin_manage_views" ON app_views;
CREATE POLICY "tenant_admin_manage_views" ON app_views
  FOR ALL USING (
    app_id IN (SELECT id FROM apps WHERE tenant_id = get_user_tenant_id())
    AND get_active_tenant_role() = 'tenant_admin'
  );
