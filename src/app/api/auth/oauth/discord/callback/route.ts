import { NextRequest } from "next/server";
import { handleOAuthCallback } from "@/lib/integrations/oauth-handler";

export async function GET(req: NextRequest) {
  return handleOAuthCallback(req, {
    provider: "discord",
    tokenUrl: "https://discord.com/api/oauth2/token",
    clientIdEnv: "DISCORD_CLIENT_ID",
    clientSecretEnv: "DISCORD_CLIENT_SECRET",
    callbackPath: "/api/auth/oauth/discord/callback",
    getWorkspaceName: async (tokenData, accessToken) => {
      // Fetch the guild name via Bot token after OAuth
      const guildId = tokenData.guild?.id as string | undefined;
      if (!guildId) return null;
      const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      });
      if (!res.ok) return null;
      const guild = await res.json() as { name: string };
      return guild.name;
    },
  });
}
