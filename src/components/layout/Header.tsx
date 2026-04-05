"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Search, LogOut, User, Settings, ChevronDown, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  userName: string;
  userEmail: string;
  planTier: "free" | "premium" | "internal";
}

const PLAN_BADGE = {
  internal: { label: "✦ Internal", cls: "bg-brand-teal/15 text-brand-teal border-brand-teal/30" },
  premium:  { label: "Premium",    cls: "bg-brand-yellow/15 text-amber-500 border-brand-yellow/30" },
  free:     { label: "Free",       cls: "bg-muted text-muted-foreground border-border" },
};

export function Header({
  title,
  subtitle,
  actions,
  userName,
  userEmail,
  planTier,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const plan = PLAN_BADGE[planTier];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4
                       px-6 py-3.5 border-b border-border
                       bg-background/80 dark:bg-[#060d1a]/80 backdrop-blur-md">
      {/* ── Left: title ── */}
      <div className="min-w-0">
        <h1 className="text-base font-semibold text-foreground leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      {/* ── Right: controls ── */}
      <div className="flex items-center gap-1.5 flex-shrink-0">

        {/* Search shortcut */}
        <button className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl
                           border border-border bg-muted/50 hover:bg-muted transition-colors
                           text-muted-foreground text-xs font-medium">
          <Search className="w-3.5 h-3.5" />
          <span>Buscar</span>
          <kbd className="ml-1 px-1.5 py-0.5 rounded bg-background border border-border text-[10px]">
            ⌘K
          </kbd>
        </button>

        {/* Upgrade pill (free plan only) */}
        {planTier === "free" && (
          <a
            href="/configuracoes/upgrade"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                       text-xs font-semibold text-white transition-all hover:opacity-90
                       bg-gradient-brand"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Upgrade
          </a>
        )}

        {/* Custom page actions */}
        {actions}

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen((o) => !o); setMenuOpen(false); }}
            className="relative flex items-center justify-center w-9 h-9 rounded-xl
                       text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-brand-teal rounded-full" />
          </button>

          <AnimatePresence>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-2 w-80
                             bg-card border border-border rounded-2xl shadow-xl z-20 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Notificações</p>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                     bg-brand-teal/15 text-brand-teal">3 novas</span>
                  </div>
                  <div className="divide-y divide-border">
                    {[
                      { icon: "📁", title: "Projeto iniciado", body: "Iniciação Atômica concluída", time: "2m" },
                      { icon: "🤖", title: "IA processou reunião", body: "Ata gerada e salva no Drive", time: "1h" },
                      { icon: "⭐", title: "NPS atualizado", body: "Score subiu para 8.4/10", time: "3h" },
                    ].map((n, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                        <span className="text-lg flex-shrink-0 mt-0.5">{n.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{n.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5">{n.time}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2.5 border-t border-border">
                    <button className="w-full text-center text-xs text-brand-teal font-medium hover:underline">
                      Ver todas
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => { setMenuOpen((o) => !o); setNotifOpen(false); }}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-muted transition-colors"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ring-2 ring-brand-teal/30"
              style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <ChevronDown className={cn(
              "hidden sm:block w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
              menuOpen && "rotate-180"
            )} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-2 w-60
                             bg-card border border-border rounded-2xl shadow-xl z-20 overflow-hidden"
                >
                  {/* Profile header */}
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
                    <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                    <span className={cn(
                      "mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                      plan.cls
                    )}>
                      {plan.label}
                    </span>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <a href="/configuracoes/perfil"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                      <User className="w-4 h-4 text-muted-foreground" />
                      Meu Perfil
                    </a>
                    <a href="/configuracoes"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      Configurações
                    </a>
                  </div>

                  <div className="border-t border-border py-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm
                                 text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sair
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
