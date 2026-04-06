// Force dynamic rendering for all auth pages
// (Supabase auth-helpers reads cookies during SSR, which prevents static generation)
export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
