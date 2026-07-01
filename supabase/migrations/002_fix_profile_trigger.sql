-- ユーザー作成失敗 "Database error saving new user" の修正
-- Supabase SQL Editor でこのファイルを実行してください

-- 1. トリガー関数を修正（SECURITY DEFINER + search_path）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. サインアップ時の profiles INSERT を許可（トリガー経由）
DROP POLICY IF EXISTS "allow_signup_insert" ON profiles;
CREATE POLICY "allow_signup_insert" ON profiles
  FOR INSERT
  WITH CHECK (true);

-- 3. 最初のユーザーを super_admin にする関数（任意）
CREATE OR REPLACE FUNCTION public.promote_first_user_to_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.profiles) = 1 THEN
    UPDATE public.profiles SET role = 'super_admin' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_promote ON profiles;
CREATE TRIGGER on_profile_created_promote
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_first_user_to_admin();
