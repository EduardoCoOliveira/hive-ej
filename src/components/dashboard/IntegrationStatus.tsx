import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Provider = "google" | "clickup" | "notion" | "discord" | "canva" | "figma";

interface Integration {
  provider: Provider;
  is_active: boolean;
  connected_at: string;
}

const providerConfig: Record<Provider, { label: string; icon: string }> = {
  google:  { label: "Google Workspace", icon: "🔵" },
  clickup: { label: "ClickUp",          icon: "🟣" },
  notion:  { label: "Notion",           icon: "⬛" },
  discord: { label: "Discord",          icon: "🟦" },
  canva:   { label: "Canva",            icon: "🟩" },
  figma:   { label: "Figma",            icon: "🎨" },
};

const allProviders: Provider[] = ["google", "clickup", "notion", "discord", "canva", "figma"];

interface Props {
  integrations: Integration[];
  planTier: "free" | "premium" | "internal";
}

export function IntegrationStatus({ integrations, planTier }: Props) {
  const hasPremium = planTier === "premium" || planTier === "internal";
  const activeProviders = new Set(integrations.map((i) => i.provider));

  return (
    <div className="card-brand p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Integrações</h3>
        <Link href="/integracoes"
          className="flex items-center gap-1 text-xs text-brand-teal hover:text-brand-teal/80 font-medium transition-colors">
          Gerenciar
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-1">
        {allProviders.map((provider) => {
          const config = providerConfig[provider];
          const isConnected = activeProviders.has(provider);
          const isLocked = !hasPremium && provider !== "google";

          return (
            <div key={provider}
              className="flex items-center justify-between py-1.5 px-1">
              <div className="flex items-center gap-2">
                <span className="text-base">{config.icon}</span>
                <span className={cn(
                  "text-sm font-medium",
                  isLocked ? "text-muted-foreground/40" : "text-foreground"
                )}>
                  {config.label}
                </span>
              </div>

              <div className="flex items-center">
                {isLocked ? (
                  <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
                ) : isConnected ? (
                  <span className="flex items-center gap-1.5 text-xs text-brand-teal font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse" />
                    Ativo
                  </span>
                ) : (
                  <Link href={`/integracoes?connect=${provider}`}
                    className="text-xs text-muted-foreground hover:text-brand-teal font-medium transition-colors">
                    Conectar
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
