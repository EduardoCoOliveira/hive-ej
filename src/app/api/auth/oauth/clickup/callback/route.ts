import { NextRequest } from "next/server";
import { handleOAuthCallback } from "@/lib/integrations/oauth-handler";

export async function GET(req: NextRequest) {
  return handleOAuthCallback(req, {
    provider: "clickup",
    tokenUrl: "https://api.clickup.com/api/v2/oauth/token",
    clientIdEnv: "CLICKUP_CLIENT_ID",
    clientSecretEnv: "CLICKUP_CLIENT_SECRET",
    callbackPath: "/api/auth/oauth/clickup/callback",
    getWorkspaceName: async (_tokenData, accessToken) => {
      const res = await fetch("https://api.clickup.com/api/v2/team", {
        headers: { Authorization: accessToken },
      });
      if (!res.ok) return null;
      const data = await res.json() as { teams: Array<{ name: string }> };
      return data.teams?.[0]?.name ?? null;
    },
  });
}
