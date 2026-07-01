"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(code.trim())) {
      setError("認証コードは6桁の数字です");
      return;
    }
    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください");
      return;
    }
    if (password !== confirm) {
      setError("確認用パスワードが一致しません");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // 6桁コードを検証（成功するとセッションが確立される）
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });

    if (verifyError) {
      setError(
        /expired|invalid/i.test(verifyError.message)
          ? "コードが正しくないか、有効期限（10分）が切れています。もう一度お試しください。"
          : verifyError.message
      );
      setLoading(false);
      return;
    }

    // 新しいパスワードを設定
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // 一旦サインアウトし、新しいパスワードでのログインを促す
    await supabase.auth.signOut();
    router.push("/login?reset=success");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Bridge-code</h1>
          <p className="text-xs text-gray-500 mt-1">by ForvalCrossGear+</p>
        </div>
        <Card title="パスワードの変更">
          <p className="text-sm text-gray-500 mb-4">
            メールで届いた6桁の認証コードと、新しいパスワードを入力してください。
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="メールアドレス"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label="認証コード（6桁）"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="123456"
              required
            />
            <Input
              label="新しいパスワード"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="8文字以上"
            />
            <Input
              label="新しいパスワード（確認）"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "変更中..." : "パスワードを変更"}
            </Button>
            <p className="text-sm text-center">
              <Link href="/forgot-password" className="text-blue-600 hover:underline">
                コードを再送する
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
