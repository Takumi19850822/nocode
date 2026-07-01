import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";

export const runtime = "edge";

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "super_admin" && profile.role !== "tenant_admin") {
    redirect("/");
  }

  return <>{children}</>;
}
