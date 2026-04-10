import { redirect } from "next/navigation";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";

// All dashboard pages are dynamic — they check auth via cookies on every request
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerSupabaseClient();

  // Verifica sessão
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sessão inválida ou expirada → limpa cookies para evitar redirect loop
  if (!user) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  // Busca perfil com admin client (bypassa RLS recursiva)
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, avatar_url, role, organization_id")
    .eq("id", user.id)
    .single();

  // Sem perfil = novo usuário sem organização → envia para registro
  if (!profile) redirect("/register");

  const { data: org } = await admin
    .from("organizations")
    .select("id, name, plan_tier")
    .eq("id", profile.organization_id)
    .single();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar
        planTier={(org?.plan_tier as "free" | "premium" | "internal") ?? "free"}
        orgName={org?.name ?? "Minha EJ"}
        userAvatar={profile.avatar_url}
        userName={profile.full_name}
      />

      {/* Conteúdo principal */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
