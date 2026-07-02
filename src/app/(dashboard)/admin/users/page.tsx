"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import {
  PageBody,
  PageFrame,
  PageHeader,
  PageSection,
} from "@/components/layout/PageLayout";
import type { Profile, Tenant, UserRole } from "@/types";
import { Shield, ShieldOff, Users } from "lucide-react";

const PAGE_SIZE = 20;

interface MemberRow {
  user_id: string;
  tenant_id: string;
  role: UserRole;
  is_active: boolean;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState("");
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    const [usersRes, tenantsRes, membersRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("tenants").select("*").order("name"),
      supabase.from("tenant_members").select("user_id, tenant_id, role, is_active"),
    ]);
    setUsers(usersRes.data ?? []);
    setTenants(tenantsRes.data ?? []);
    setMembers((membersRes.data as MemberRow[] | null) ?? []);
    setLoading(false);
  }

  async function handleSuperAdminAction(userId: string, action: "grant" | "revoke") {
    const target = users.find((u) => u.id === userId);
    const label = action === "grant" ? "スーパー管理者に昇格" : "スーパー管理者を解除";
    const message =
      action === "grant"
        ? `「${target?.email}」をスーパー管理者にしますか？`
        : `「${target?.email}」のスーパー管理者権限を解除しますか？`;

    if (!confirm(message)) return;

    setActionError("");
    setActionUserId(userId);

    try {
      const res = await fetch(`/api/admin/users/${userId}/super-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? `${label}に失敗しました`);
        return;
      }
      await loadData();
    } catch {
      setActionError(`${label}に失敗しました`);
    } finally {
      setActionUserId(null);
    }
  }

  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name ?? "-";
  const roleLabel = (r: UserRole) =>
    ({ super_admin: "スーパー管理者", tenant_admin: "テナント管理者", user: "一般ユーザー" })[r];

  const membershipsOf = (userId: string) =>
    members.filter((m) => m.user_id === userId);

  const platformAdmins = users.filter((u) => u.role === "super_admin");
  const tenantUsers = users.filter((u) => u.role !== "super_admin");
  const pagedTenantUsers = tenantUsers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  if (loading) return <p className="text-gray-500">読み込み中...</p>;

  return (
    <PageFrame>
      <PageHeader
        title="ユーザー管理（Admin）"
        description={
          <>
            1ユーザーは複数テナントに所属できます。テナントへの追加・ロール変更は{" "}
            <Link href="/admin/tenants" className="text-slate-300 hover:text-white underline">
              テナント管理 → ユーザー管理
            </Link>{" "}
            から行ってください。
          </>
        }
      />

      <PageBody>
        {actionError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {actionError}
          </p>
        )}

        <PageSection title="プラットフォーム管理者（super_admin）">
          <p className="text-xs text-gray-500 mb-4">
            スーパー管理者は全テナント・全アプリを管理できます。下の一覧からユーザーを昇格するか、
            既存のスーパー管理者の権限を解除できます。
          </p>
          <table className="stack-table w-full text-sm">
            <thead>
              <tr>
                <th>名前</th>
                <th>メール</th>
                <th>ロール</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {platformAdmins.map((user) => (
                <tr key={user.id}>
                  <td className="py-3 font-medium" data-label="名前">{user.display_name}</td>
                  <td className="py-3 text-gray-500 break-all" data-label="メール">{user.email}</td>
                  <td className="py-3" data-label="ロール">
                    <Badge variant="warning">{roleLabel(user.role)}</Badge>
                  </td>
                  <td className="py-3" data-label="操作">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={actionUserId === user.id || platformAdmins.length <= 1}
                      onClick={() => handleSuperAdminAction(user.id, "revoke")}
                      title={
                        platformAdmins.length <= 1
                          ? "最後のスーパー管理者は解除できません"
                          : undefined
                      }
                    >
                      <ShieldOff className="w-4 h-4 mr-1" />
                      {actionUserId === user.id ? "処理中..." : "解除"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PageSection>

        <PageSection title="ユーザーと所属テナント" bordered>
          <table className="stack-table w-full text-sm">
            <thead>
              <tr>
                <th>名前</th>
                <th>メール</th>
                <th>所属テナント / ロール</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedTenantUsers.map((user) => {
                const ms = membershipsOf(user.id);
                return (
                  <tr key={user.id} className="align-top">
                    <td className="py-3 font-medium" data-label="名前">
                      {user.display_name?.trim() || "（未設定）"}
                    </td>
                    <td className="py-3 text-gray-500 break-all" data-label="メール">{user.email}</td>
                    <td className="py-3" data-label="所属テナント / ロール">
                      {ms.length === 0 ? (
                        <span className="text-gray-400">未所属</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {ms.map((m) => (
                            <Link
                              key={m.tenant_id}
                              href={`/admin/tenants/${m.tenant_id}/users`}
                              className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 hover:bg-gray-50"
                              title="テナントのユーザー管理"
                            >
                              <Users className="w-3 h-3 text-gray-400" />
                              <span>{tenantName(m.tenant_id)}</span>
                              <Badge
                                variant={m.role === "tenant_admin" ? "success" : "default"}
                              >
                                {roleLabel(m.role)}
                              </Badge>
                              {!m.is_active && <Badge variant="danger">無効</Badge>}
                            </Link>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3" data-label="操作">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actionUserId === user.id}
                        onClick={() => handleSuperAdminAction(user.id, "grant")}
                      >
                        <Shield className="w-4 h-4 mr-1" />
                        {actionUserId === user.id ? "処理中..." : "昇格"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {tenantUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">
                    ユーザーがいません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={tenantUsers.length}
            onPageChange={setPage}
          />
        </PageSection>
      </PageBody>
    </PageFrame>
  );
}
