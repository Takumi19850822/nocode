"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card, Badge, Modal } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import type { Profile, Tenant, UserRole } from "@/types";
import { Pencil, Users } from "lucide-react";

const ASSIGNABLE_ROLES = [
  { label: "テナント管理者", value: "tenant_admin" },
  { label: "一般ユーザー", value: "user" },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [tenantId, setTenantId] = useState("");

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [usersRes, tenantsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("tenants").select("*").order("name"),
    ]);
    setUsers(usersRes.data ?? []);
    setTenants(tenantsRes.data ?? []);
    setLoading(false);
  }

  function openEdit(user: Profile) {
    if (user.role === "super_admin") return;
    setEditing(user);
    setEmail(user.email);
    setDisplayName(user.display_name);
    setRole(user.role);
    setTenantId(user.tenant_id ?? "");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!editing) return;
    await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        role: role === "super_admin" ? "user" : role,
        tenant_id: tenantId || null,
      })
      .eq("id", editing.id);
    setModalOpen(false);
    loadData();
  }

  async function toggleActive(user: Profile) {
    if (user.role === "super_admin") return;
    await supabase
      .from("profiles")
      .update({ is_active: !user.is_active })
      .eq("id", user.id);
    loadData();
  }

  const roleLabel = (r: UserRole) =>
    ({ super_admin: "スーパー管理者", tenant_admin: "テナント管理者", user: "一般ユーザー" })[r];

  const platformAdmins = users.filter((u) => u.role === "super_admin");
  const tenantUsers = users.filter((u) => u.role !== "super_admin");

  if (loading) return <p className="text-gray-500">読み込み中...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ユーザー管理（Admin）</h1>
        <p className="text-gray-500 text-sm mt-1">
          テナントごとのユーザー追加は{" "}
          <Link href="/admin/tenants" className="text-blue-600 hover:underline">
            テナント管理 → ユーザー管理
          </Link>{" "}
          から行ってください
        </p>
      </div>

      <Card title="プラットフォーム管理者（super_admin）">
        <p className="text-xs text-gray-500 mb-4">
          super_admin はあなたのみ。アプリから他ユーザーへの付与はできません。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-3 font-medium">名前</th>
                <th className="pb-3 font-medium">メール</th>
                <th className="pb-3 font-medium">ロール</th>
              </tr>
            </thead>
            <tbody>
              {platformAdmins.map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="py-3 font-medium">{user.display_name}</td>
                  <td className="py-3 text-gray-500">{user.email}</td>
                  <td className="py-3">
                    <Badge variant="warning">{roleLabel(user.role)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="テナント所属ユーザー">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-3 font-medium">名前</th>
                <th className="pb-3 font-medium">メール</th>
                <th className="pb-3 font-medium">ロール</th>
                <th className="pb-3 font-medium">テナント</th>
                <th className="pb-3 font-medium">状態</th>
                <th className="pb-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {tenantUsers.map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="py-3 font-medium">{user.display_name}</td>
                  <td className="py-3 text-gray-500">{user.email}</td>
                  <td className="py-3">
                    <Badge variant={user.role === "tenant_admin" ? "success" : "default"}>
                      {roleLabel(user.role)}
                    </Badge>
                  </td>
                  <td className="py-3 text-gray-500">
                    {tenants.find((t) => t.id === user.tenant_id)?.name ?? "-"}
                  </td>
                  <td className="py-3">
                    <button onClick={() => toggleActive(user)}>
                      <Badge variant={user.is_active ? "success" : "danger"}>
                        {user.is_active ? "有効" : "無効"}
                      </Badge>
                    </button>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      {user.tenant_id && (
                        <Link
                          href={`/admin/tenants/${user.tenant_id}/users`}
                          className="text-gray-400 hover:text-blue-600"
                          title="テナントのユーザー管理"
                        >
                          <Users className="w-4 h-4" />
                        </Link>
                      )}
                      <button
                        onClick={() => openEdit(user)}
                        className="text-gray-400 hover:text-blue-600"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="ユーザー編集"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="メール" value={email} disabled />
          <Input
            label="表示名"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Select
            label="ロール"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            options={ASSIGNABLE_ROLES}
          />
          <Select
            label="テナント"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            options={[
              { label: "なし", value: "" },
              ...tenants.map((t) => ({ label: t.name, value: t.id })),
            ]}
          />
        </div>
      </Modal>
    </div>
  );
}
