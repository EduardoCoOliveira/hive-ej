import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "./database.types";

// Cliente para uso em Client Components (browser)
// flowType: 'implicit' → magic links usam token_hash (funciona cross-browser)
// flowType: 'pkce' (padrão) exige que o code_verifier esteja no mesmo browser
export function createClient() {
  return createClientComponentClient<Database>({
    options: {
      auth: {
        flowType: "implicit",
      },
    },
  });
}
