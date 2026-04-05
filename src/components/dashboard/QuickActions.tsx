import Link from "next/link";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  planTier: "free" | "premium" | "internal";
}

const actions = [
  { label: "Novo Projeto",       href: "/projetos/novo",         icon: "📁", free: true },
  { label: "Nova Wiki",          href: "/wiki/nova",              icon: "📝", free: true },
  { label: "Gerar Contrato",     href: "/documentos/novo",        icon: "📄", free: false },
  { label: "Alocar Consultor",   href: "/competencias/alocar",    icon: "🧠", free: false },
];

export function QuickActions({ planTier }: QuickActionsProps) {
  const hasPremium = planTier === "premium" || planTier === "internal";

  return (
    <div className="card-brand p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3">Ações Rápidas</h3>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const locked = !action.free && !hasPremium;
          return (
            <Link
              key={action.href}
              href={locked ? "/configuracoes/upgrade" : action.href}
              className={cn(
                "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center",
                "transition-all duration-150",
                locked
                  ? "border-border opacity-50 cursor-default"
                  : "border-border hover:border-brand-teal/40 hover:bg-brand-teal/5 group"
              )}
            >
              <span className="text-xl">{action.icon}</span>
              <span className="text-xs font-medium text-foreground leading-tight">
                {action.label}
              </span>
              {locked && (
                <Lock className="absolute top-2 right-2 w-3 h-3 text-muted-foreground/50" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
