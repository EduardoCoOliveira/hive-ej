import { NextRequest } from "next/server";
import { handleOAuthCallback } from "@/lib/integrations/oauth-handler";

export async function GET(req: NextRequest) {
  return handleOAuthCallback(req, {
    provider: "google_workspace",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    callbackPath: "/api/auth/oauth/google-workspace/callback",
    getWorkspaceName: async (_tokenData, accessToken) => {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const info = await res.json() as { hd?: string; email?: string };
      return info.hd ?? info.email?.split("@")[1] ?? null;
    },
  });
}
