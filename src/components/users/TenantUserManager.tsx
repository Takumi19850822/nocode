"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Badge, Modal } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import {
  PageBody,
  PageFrame,
  PageHeader,
  PageSection,
} from "@/components/layout/PageLayout";
import type { UserRole } from "@/types";
import { Pencil, Shield, User, UserMinus } from "lucide-react";

const PAGE_SIZE = 20;

/** テナント所属ユーザー（メンバーシップ + プロフィール氏名） */
interface TenantMember {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
}

interface TenantUserManagerProps {
  tenantId: string;
  tenantName: string;
  backHref?: string;
}

export function TenantUserManager({
  tenantId,
  tenantName,
  backHref,
}: TenantUserManagerProps) {
  const [users, setUsers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [canCreateUsers, setCanCreateUsers] = useState(false);
  const [canManageTenantAdmins, setCanManageTenantAdmins] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<TenantMember | null>(null);
  const [error, setError] = useState("");
  const [userPage, setUserPage] = useState(1);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("user");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/tenants/${tenantId}/users`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "読み込みに失敗しました");
      setLoading(false);
      return;
    }
    setUsers(data.users ?? []);
    setCanCreateUsers(Boolean(data.canCreateUsers));
    setCanManageTenantAdmins(Boolean(data.canManageTenantAdmins));
    setError("");
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const tenantAdmins = users.filter((u) => u.role === "tenant_admin");
  const regularUsers = users.filter((u) => u.role === "user");

  function openCreate(assignRole: UserRole) {
    setEmail("");
    setPassword("");
    setDisplayName("");
    setRole(assignRole);
    setError("");
    setCreateOpen(true);
  }

  function openEdit(user: TenantMember) {
    setEditing(user);
    setDisplayName(user.display_name);
    setRole(user.role);
    setError("");
    setEditOpen(true);
  }

  async function handleCreate() {
    setError("");
    if (!displayName.trim()) {
      setError("氏名を入力してください");
      return;
    }
    const res = await fetch(`/api/tenants/${tenantId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        display_name: displayName,
        role,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "作成に失敗しました");
      return;
    }
    setCreateOpen(false);
    loadUsers();
  }

  async function handleUpdate() {
    if (!editing) return;
    if (!displayName.trim()) {
      setError("氏名を入力してください");
      return;
    }
    setError("");
    const res = await fetch(`/api/tenants/${tenantId}/users/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        role: canManageTenantAdmins || editing.role === "user" ? role : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "更新に失敗しました");
      return;
    }
    setEditOpen(false);
    loadUsers();
  }

  async function toggleActive(user: TenantMember) {
    await fetch(`/api/tenants/${tenantId}/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !user.is_active }),
    });
    loadUsers();
  }

  async function removeFromTenant(user: TenantMember) {
    if (
      !confirm(
        `${user.display_name || user.email} をこのテナントから外しますか？（アカウント自体は削除されません）`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/tenants/${tenantId}/users/${user.id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "削除に失敗しました");
      return;
    }
    loadUsers();
  }

  const createTitle =
    role === "tenant_admin" ? "テナント管理者を追加" : "一般ユーザーを追加";

  const editRoleOptions =
    canManageTenantAdmins
      ? [
          { label: "一般ユーザー", value: "user" },
          { label: "テナント管理者", value: "tenant_admin" },
        ]
      : [{ label: "一般ユーザー", value: "user" }];

  if (loading) return <p className="text-gray-500">読み込み中...</p>;

  return (
    <PageFrame>
      <PageHeader
        title="ユーザー管理"
        description={`テナント: ${tenantName}`}
        backHref={backHref}
        actions={
          <>
            {canManageTenantAdmins && (
              <Button variant="secondary" onClick={() => openCreate("tenant_admin")}>
                <Shield className="w-4 h-4 mr-1" />
                テナント管理者を追加
              </Button>
            )}
            <Button onClick={() => openCreate("user")}>
              <User className="w-4 h-4 mr-1" />
              一般ユーザーを追加
            </Button>
          </>
        }
      />

      <PageBody>
        {canManageTenantAdmins && (
          <PageSection>
            <p className="text-sm text-gray-600">
              <strong>運用フロー:</strong> ① テナント管理者を指定 → ② 一般ユーザーを追加。
              テナント管理者は自テナントの一般ユーザーのみ管理できます。
            </p>
          </PageSection>
        )}

        {!canCreateUsers && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            新規アカウント作成には <code className="text-xs">SUPABASE_SECRET_KEY</code>{" "}
            の設定が必要です。未設定の場合、既存ユーザーのテナント割当のみ可能です。
          </div>
        )}

        {error && !createOpen && !editOpen && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <UserTable
          title="テナント管理者"
          users={tenantAdmins}
          emptyMessage="テナント管理者が未設定です。先に管理者を追加してください。"
          onEdit={openEdit}
          onToggle={toggleActive}
          onRemove={removeFromTenant}
          bordered={canManageTenantAdmins}
        />

        <UserTable
          title="一般ユーザー"
          users={regularUsers.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE)}
          emptyMessage="一般ユーザーがいません。"
          onEdit={openEdit}
          onToggle={toggleActive}
          onRemove={removeFromTenant}
          bordered
          footer={
            <Pagination
              page={userPage}
              pageSize={PAGE_SIZE}
              total={regularUsers.length}
              onPageChange={setUserPage}
            />
          }
        />
      </PageBody>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={createTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleCreate}>追加</Button>
          </>
        }
      >
        <div className="space-y-4">
          {role === "tenant_admin" && (
            <p className="text-sm text-blue-700 bg-blue-50 rounded-lg p-3">
              このユーザーはテナント「{tenantName}」の管理者になります。
              アプリ設計・一般ユーザー管理が可能です。
            </p>
          )}
          <Input
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="氏名"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          {canCreateUsers && (
            <Input
              label="初期パスワード"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="8文字以上"
            />
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="ユーザー編集"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleUpdate}>保存</Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Input label="メール" value={editing.email} disabled />
            <Input
              label="氏名"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            {(canManageTenantAdmins || editing.role === "user") && (
              <Select
                label="ロール"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                options={editRoleOptions}
              />
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
      </Modal>
    </PageFrame>
  );
}

function UserTable({
  title,
  users,
  emptyMessage,
  onEdit,
  onToggle,
  onRemove,
  footer,
  bordered = false,
}: {
  title: string;
  users: TenantMember[];
  emptyMessage: string;
  onEdit: (user: TenantMember) => void;
  onToggle: (user: TenantMember) => void;
  onRemove: (user: TenantMember) => void;
  footer?: React.ReactNode;
  bordered?: boolean;
}) {
  return (
    <PageSection title={title} bordered={bordered}>
      <table className="stack-table w-full text-sm">
        <thead>
          <tr>
            <th>名前</th>
            <th>メール</th>
            <th>状態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td className="py-3 font-medium" data-label="名前">{user.display_name?.trim() || "（未設定）"}</td>
              <td className="py-3 text-gray-500 break-all" data-label="メール">{user.email}</td>
              <td className="py-3" data-label="状態">
                <button onClick={() => onToggle(user)}>
                  <Badge variant={user.is_active ? "success" : "danger"}>
                    {user.is_active ? "有効" : "無効"}
                  </Badge>
                </button>
              </td>
              <td className="py-3" data-label="操作">
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(user)}
                    className="text-gray-400 hover:text-blue-600"
                    title="編集"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onRemove(user)}
                    className="text-gray-400 hover:text-red-600"
                    title="このテナントから外す"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {footer}
    </PageSection>
  );
}
