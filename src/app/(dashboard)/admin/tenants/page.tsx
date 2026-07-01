"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge, Modal } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import {
  PageBody,
  PageFrame,
  PageHeader,
  PageSection,
} from "@/components/layout/PageLayout";
import { slugify } from "@/lib/utils";
import type { Tenant } from "@/types";
import { Plus, Pencil, Trash2, Users, LayoutGrid } from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 20;

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const supabase = createClient();

  useEffect(() => {
    loadTenants();
  }, []);

  async function loadTenants() {
    const { data } = await supabase.from("tenants").select("*").order("created_at");
    setTenants(data ?? []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setSlug("");
    setModalOpen(true);
  }

  function openEdit(tenant: Tenant) {
    setEditing(tenant);
    setName(tenant.name);
    setSlug(tenant.slug);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;

    if (editing) {
      await supabase
        .from("tenants")
        .update({ name, slug: slug || slugify(name) })
        .eq("id", editing.id);
      setModalOpen(false);
      loadTenants();
    } else {
      const { data: created } = await supabase
        .from("tenants")
        .insert({ name, slug: slug || slugify(name) })
        .select("id")
        .single();
      setModalOpen(false);
      if (created) {
        window.location.href = `/admin/tenants/${created.id}/users`;
      } else {
        loadTenants();
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("このテナントを削除しますか？")) return;
    await supabase.from("tenants").delete().eq("id", id);
    loadTenants();
  }

  async function toggleActive(tenant: Tenant) {
    await supabase
      .from("tenants")
      .update({ is_active: !tenant.is_active })
      .eq("id", tenant.id);
    loadTenants();
  }

  if (loading) return <p className="text-gray-500">読み込み中...</p>;

  const pagedTenants = tenants.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <PageFrame>
      <PageHeader
        title="テナント管理"
        description="Admin > テナント"
        actions={
          <Button onClick={openCreate} className="w-full sm:w-auto shrink-0">
            <Plus className="w-4 h-4 mr-1" />
            新規テナント
          </Button>
        }
      />

      <PageBody>
        <PageSection>
          <table className="stack-table w-full text-sm">
            <thead>
              <tr>
                <th>名前</th>
                <th>スラッグ</th>
                <th>状態</th>
                <th>作成日</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedTenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td className="py-3 font-medium" data-label="名前">{tenant.name}</td>
                  <td className="py-3 text-gray-500 break-all" data-label="スラッグ">{tenant.slug}</td>
                  <td className="py-3" data-label="状態">
                    <button onClick={() => toggleActive(tenant)}>
                      <Badge variant={tenant.is_active ? "success" : "danger"}>
                        {tenant.is_active ? "有効" : "無効"}
                      </Badge>
                    </button>
                  </td>
                  <td className="py-3 text-gray-500" data-label="作成日">
                    {new Date(tenant.created_at).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="py-3" data-label="操作">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/tenants/${tenant.id}/users`}
                        className="text-gray-400 hover:text-blue-600"
                        title="ユーザー管理"
                      >
                        <Users className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/admin/tenants/${tenant.id}/apps`}
                        className="text-gray-400 hover:text-blue-600"
                        title="アプリ管理"
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => openEdit(tenant)}
                        className="text-gray-400 hover:text-blue-600"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(tenant.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    テナントがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={tenants.length}
            onPageChange={setPage}
          />
        </PageSection>
      </PageBody>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "テナント編集" : "新規テナント"}
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
          <Input
            label="テナント名"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!editing) setSlug(slugify(e.target.value));
            }}
            required
          />
          <Input
            label="スラッグ"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="example-company"
          />
        </div>
      </Modal>
    </PageFrame>
  );
}
