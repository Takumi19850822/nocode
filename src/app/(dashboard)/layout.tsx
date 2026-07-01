import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
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
    <DashboardShell profile={profile} apps={apps}>
      {children}
    </DashboardShell>
  );
}
