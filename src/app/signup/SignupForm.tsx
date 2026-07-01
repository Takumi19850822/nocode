"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("Admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    const { data: allowed } = await supabase.rpc("is_signup_allowed");
    if (!allowed && process.env.NEXT_PUBLIC_ALLOW_SIGNUP !== "true") {
      setError("新規登録は無効です。管理者に招待してもらってください。");
      setLoading(false);
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });

    if (authError) {
      if (authError.message.includes("Database error")) {
        setError(
          "DBエラー: Supabase SQL Editor で migrations/002, 003 を実行してください"
        );
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }

    alert("登録しました。メール確認が必要な場合はリンクをクリック後、ログインしてください。");
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Bridge-code</h1>
        <p className="text-xs text-gray-500 mt-1">by ForvalCrossGear+</p>
      </div>
      <Card title="初回アカウント作成">
        <p className="text-sm text-gray-500 mb-4">
          初回セットアップ専用です。super_admin は SQL でのみ設定されます（自動昇格なし）。
        </p>
        <form onSubmit={handleSignup} className="space-y-4">
          <Input
            label="氏名"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
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
            minLength={8}
            autoComplete="new-password"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "作成中..." : "アカウント作成"}
          </Button>
        </form>
        <p className="text-sm text-center mt-4 text-gray-500">
          既にアカウントがある？{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            ログイン
          </Link>
        </p>
      </Card>
      </div>
    </div>
  );
}
