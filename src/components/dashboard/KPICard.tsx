import { GlowCard } from "@/components/ui/glow-card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  icon: string;
  trend?: number;
  trendLabel?: string;
  color: "teal" | "navy" | "yellow" | "purple";
}

const colorConfig = {
  teal: {
    glow: "rgba(65,197,198,0.18)",
    iconBg: "bg-brand-teal/15 dark:bg-brand-teal/20",
    iconText: "text-brand-teal",
    trend: "text-brand-teal",
    border: "border-brand-teal/20",
  },
  navy: {
    glow: "rgba(9,37,77,0.3)",
    iconBg: "bg-blue-500/10 dark:bg-blue-400/10",
    iconText: "text-blue-500 dark:text-blue-400",
    trend: "text-blue-500 dark:text-blue-400",
    border: "border-blue-500/20",
  },
  yellow: {
    glow: "rgba(254,192,69,0.18)",
    iconBg: "bg-brand-yellow/15 dark:bg-brand-yellow/20",
    iconText: "text-amber-500",
    trend: "text-amber-500",
    border: "border-brand-yellow/20",
  },
  purple: {
    glow: "rgba(78,55,140,0.25)",
    iconBg: "bg-brand-purple/15 dark:bg-brand-purple/20",
    iconText: "text-brand-purple dark:text-purple-400",
    trend: "text-brand-purple dark:text-purple-400",
    border: "border-brand-purple/20",
  },
};

export function KPICard({ label, value, icon, trend, trendLabel, color }: KPICardProps) {
  const c = colorConfig[color];
  const isPositive = (trend ?? 0) >= 0;

  return (
    <GlowCard glowColor={c.glow} className={cn("border bg-card", c.border)}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-lg", c.iconBg)}>
            {icon}
          </div>

          {trend !== undefined && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg",
              isPositive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 text-red-500"
            )}>
              {isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {isPositive ? "+" : ""}{trend}{trendLabel ?? ""}
            </div>
          )}
        </div>

        <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-1 font-medium">{label}</p>
      </div>
    </GlowCard>
  );
}
