import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Cliente Supabase para Route Handlers e Server Components.
 * Usa a sessão do usuário (respeita RLS).
 */
export function createServerClient() {
  return createRouteHandlerClient<Database>({ cookies });
}

// Alias para backward compatibility
export const createServerSupabaseClient = createServerClient;

/**
 * Cliente Supabase com service role key — bypassa RLS.
 * Usar SOMENTE em contextos server-side onde o usuário já foi autenticado
 * via getUser() e o acesso aos dados é filtrado manualmente (ex: WHERE id = user.id).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });
}
