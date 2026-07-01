"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

function LoginFormInner({ showSignupLink }: { showSignupLink: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signupDisabled = searchParams.get("error") === "signup_disabled";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  const resetDone = searchParams.get("reset") === "success";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Bridge-code</h1>
          <p className="text-xs text-gray-500 mt-1">by ForvalCrossGear+</p>
        </div>
        <Card title="ログイン">
        {signupDisabled && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            新規登録は無効です。管理者に招待してもらってください。
          </p>
        )}
        {resetDone && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            パスワードを変更しました。新しいパスワードでログインしてください。
          </p>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="パスワード"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "ログイン中..." : "ログイン"}
          </Button>
          <p className="text-sm text-center">
            <Link href="/forgot-password" className="text-blue-600 hover:underline">
              パスワードをお忘れですか？
            </Link>
          </p>
          {showSignupLink && (
            <p className="text-sm text-center text-gray-500">
              初回セットアップ？{" "}
              <Link href="/signup" className="text-blue-600 hover:underline">
                アカウント作成
              </Link>
            </p>
          )}
        </form>
        </Card>
      </div>
    </div>
  );
}

export function LoginForm({ showSignupLink }: { showSignupLink: boolean }) {
  return (
    <Suspense>
      <LoginFormInner showSignupLink={showSignupLink} />
    </Suspense>
  );
}
