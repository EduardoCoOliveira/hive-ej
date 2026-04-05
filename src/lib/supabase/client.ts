import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "./database.types";

// Cliente para uso em Client Components (browser)
export function createClient() {
  return createClientComponentClient<Database>();
}
