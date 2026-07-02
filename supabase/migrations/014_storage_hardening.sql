-- 014: Storage バケット record-exports のハードニング
-- 目的:
--   record-exports は非公開バケットで、アップロード/ダウンロードは
--   API 経由の service role のみが行う想定（署名付きURLの発行や
--   クライアントからの直接アクセスは行っていない）。
--   本マイグレーションは、将来ダッシュボード等で誤って緩いポリシーが
--   追加された場合でも、このバケットへの一般ユーザーアクセスを
--   明示的にブロックするための多層防御。

-- 1. バケットが非公開であることを再保証
UPDATE storage.buckets SET public = false WHERE id = 'record-exports';

-- 2. service_role 以外からの一切のアクセスを明示的に拒否
--    （storage.objects は Supabase 側で RLS 有効・デフォルト拒否だが、
--     本ポリシーは record-exports バケットに限定してさらに明示化する。
--     他バケットの行には一切影響しない = 他ポリシーの判断に委ねる）
DROP POLICY IF EXISTS "record_exports_service_role_only" ON storage.objects;
CREATE POLICY "record_exports_service_role_only" ON storage.objects
  FOR ALL
  USING (bucket_id = 'record-exports' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'record-exports' AND auth.role() = 'service_role');
