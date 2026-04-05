import { NextRequest } from "next/server";
import { handleOAuthCallback } from "@/lib/integrations/oauth-handler";

export async function GET(req: NextRequest) {
  return handleOAuthCallback(req, {
    provider: "notion",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    clientIdEnv: "NOTION_CLIENT_ID",
    clientSecretEnv: "NOTION_CLIENT_SECRET",
    callbackPath: "/api/auth/oauth/notion/callback",
    getWorkspaceName: async (tokenData) => {
      return (tokenData.workspace_name as string) ?? null;
    },
  });
}
