"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    // 登録済みユーザーにのみ 6 桁のワンタイムコードをメール送信する
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    // ユーザー列挙を防ぐため、存在有無に関わらずコード入力画面へ進む
    if (otpError && !/Signups not allowed|not allowed for otp/i.test(otpError.message)) {
      setError(otpError.message);
      setLoading(false);
      return;
    }

    router.push(`/reset-password?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Bridge-code</h1>
          <p className="text-xs text-gray-500 mt-1">by ForvalCrossGear+</p>
        </div>
        <Card title="パスワードをお忘れの方">
          <p className="text-sm text-gray-500 mb-4">
            登録済みのメールアドレスを入力してください。パスワード変更用の
            6桁のワンタイムコード（10分間有効）をお送りします。
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
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "送信中..." : "認証コードを送信"}
            </Button>
            <p className="text-sm text-center">
              <Link href="/login" className="text-blue-600 hover:underline">
                ログイン画面に戻る
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
