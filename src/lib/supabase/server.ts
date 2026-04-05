import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Cliente Supabase para Route Handlers e Server Components.
 * Exportado como `createServerClient` para compatibilidade com todos os routes.
 * Usa createRouteHandlerClient do @supabase/auth-helpers-nextjs@0.9.x
 */
export function createServerClient() {
  return createRouteHandlerClient<Database>({ cookies });
}

// Alias para backward compatibility
export const createServerSupabaseClient = createServerClient;
