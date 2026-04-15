import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";

// All dashboard pages are dynamic — they check auth via cookies on every request
export const dynamic = "force-dynamic";

type DashboardProfile = {
  full_name: string;
  avatar_url: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  organization_id: string;
};

type DashboardOrg = {
  id: string;
  name: string;
  plan_tier: "free" | "premium" | "internal";
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  const profileResult = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role, organization_id")
    .eq("id", user.id)
    .single();
  const profile = profileResult.data as DashboardProfile | null;

  if (!profile) redirect("/register");

  const orgResult = await supabase
    .from("organizations")
    .select("id, name, plan_tier")
    .eq("id", profile.organization_id)
    .single();
  const org = orgResult.data as DashboardOrg | null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        planTier={(org?.plan_tier as "free" | "premium" | "internal") ?? "free"}
        orgName={org?.name ?? "Minha EJ"}
        userAvatar={profile.avatar_url}
        userName={profile.full_name}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
