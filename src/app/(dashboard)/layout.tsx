import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";

export const runtime = "edge";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  let apps: { id: string; name: string; icon: string }[] = [];

  if (profile.tenant_id) {
    const { data } = await supabase
      .from("apps")
      .select("id, name, icon")
      .eq("tenant_id", profile.tenant_id)
      .eq("is_active", true)
      .order("sort_order");
    apps = data ?? [];
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={profile} apps={apps} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
