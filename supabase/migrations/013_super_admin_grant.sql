-- 013: super_admin の付与を super_admin / サービスロール(SQL Editor) から可能に
-- 009 の protect_profile_sensitive_columns を差し替え

CREATE OR REPLACE FUNCTION protect_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  actor_role user_role;
BEGIN
  actor_role := get_user_role();

  -- super_admin への昇格: super_admin 操作 or サービスロール/SQL Editor のみ可
  IF TG_OP = 'UPDATE'
     AND NEW.role = 'super_admin'
     AND OLD.role IS DISTINCT FROM 'super_admin'
     AND auth.uid() IS NOT NULL
     AND COALESCE(actor_role, 'user') <> 'super_admin' THEN
    NEW.role := OLD.role;
  END IF;

  -- super_admin からの降格も同様
  IF TG_OP = 'UPDATE'
     AND OLD.role = 'super_admin'
     AND NEW.role IS DISTINCT FROM 'super_admin'
     AND auth.uid() IS NOT NULL
     AND COALESCE(actor_role, 'user') <> 'super_admin' THEN
    NEW.role := OLD.role;
  END IF;

  -- active_tenant_id は在籍テナントのみ選択可（super_admin / サービスロールは除外）
  IF TG_OP = 'UPDATE'
     AND NEW.active_tenant_id IS DISTINCT FROM OLD.active_tenant_id
     AND NEW.active_tenant_id IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND COALESCE(actor_role, 'user') <> 'super_admin'
     AND NOT EXISTS (
       SELECT 1 FROM tenant_members
       WHERE user_id = NEW.id
         AND tenant_id = NEW.active_tenant_id
         AND is_active
     ) THEN
    RAISE EXCEPTION 'not a member of the selected tenant';
  END IF;

  -- 一般ユーザーが自分のプロフィールを更新: active_tenant_id と display_name 以外は変更不可
  IF TG_OP = 'UPDATE' AND auth.uid() = OLD.id AND actor_role = 'user' THEN
    NEW.role := OLD.role;
    NEW.tenant_id := OLD.tenant_id;
    NEW.is_active := OLD.is_active;
  END IF;

  -- 非 super_admin が他人のプロフィールを更新する場合は display_name のみ変更可
  IF TG_OP = 'UPDATE'
     AND auth.uid() IS DISTINCT FROM OLD.id
     AND auth.uid() IS NOT NULL
     AND COALESCE(actor_role, 'user') <> 'super_admin' THEN
    NEW.role := OLD.role;
    NEW.tenant_id := OLD.tenant_id;
    NEW.is_active := OLD.is_active;
    NEW.active_tenant_id := OLD.active_tenant_id;
    NEW.email := OLD.email;
  END IF;

  RETURN NEW;
END;
$$;
