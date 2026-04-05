"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, FolderKanban, Zap, BookOpen, Users,
  Wallet, BookMarked, FileText, UserCircle2, Mic2, Receipt,
  Trophy, Link2, Settings, ChevronLeft, ChevronRight, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  premiumOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard",       href: "/dashboard",              icon: LayoutDashboard },
  { label: "Projetos",        href: "/projetos",               icon: FolderKanban },
  { label: "Project Hub",     href: "/project-hub",            icon: Zap,          badge: "Novo", premiumOnly: true },
  { label: "Playbooks",       href: "/playbooks",              icon: BookOpen,      premiumOnly: true },
  { label: "Competências",    href: "/competencias",           icon: Users,         premiumOnly: true },
  { label: "Financeiro",      href: "/financeiro",             icon: Wallet },
  { label: "Wiki de Bastão",  href: "/wiki",                   icon: BookMarked },
  { label: "Documentos",      href: "/documentos",             icon: FileText,      premiumOnly: true },
  { label: "Membros",         href: "/membros",                icon: UserCircle2 },
  { label: "Reuniões",        href: "/reunioes",               icon: Mic2,          badge: "IA" },
  { label: "Reembolsos",      href: "/financeiro/reembolsos",  icon: Receipt },
  { label: "Pontos & Ranking",href: "/pontos",                 icon: Trophy },
  { label: "Integrações",     href: "/integracoes",            icon: Link2,         premiumOnly: true },
];

interface SidebarProps {
  planTier: "free" | "premium" | "internal";
  orgName: string;
  userAvatar?: string | null;
  userName: string;
}

const PLAN_LABELS = {
  internal: "✦ Internal",
  premium: "Premium",
  free: "Free",
};

const PLAN_STYLES = {
  internal: "bg-brand-teal/15 text-brand-teal border border-brand-teal/30",
  premium:  "bg-brand-yellow/15 text-amber-600 dark:text-amber-400 border border-brand-yellow/30",
  free:     "bg-muted text-muted-foreground border border-border",
};

export function Sidebar({ planTier, orgName, userAvatar, userName }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const hasPremium = planTier === "premium" || planTier === "internal";

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col h-full flex-shrink-0 overflow-hidden
                 border-r border-border
                 bg-card dark:bg-[#060d1a]"
    >
      {/* Subtle gradient overlay on dark mode */}
      <div className="pointer-events-none absolute inset-0 opacity-0 dark:opacity-100
                      bg-gradient-to-b from-brand-navy/40 via-transparent to-transparent" />

      {/* ── Logo + collapse ── */}
      <div className={cn(
        "relative z-10 flex items-center border-b border-border py-5 px-4",
        collapsed ? "justify-center" : "justify-between"
      )}>
        <AnimatePresence initial={false} mode="wait">
          {!collapsed ? (
            <motion.div
              key="logo-full"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
            >
              {/* Text logo fallback if SVG not present */}
              <span className="text-lg font-bold tracking-tight text-foreground">
                Hï<span className="text-brand-teal">ve</span>
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="relative z-10 flex items-center justify-center w-7 h-7 rounded-lg
                     text-muted-foreground hover:text-foreground hover:bg-muted
                     transition-colors flex-shrink-0"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* ── Org section ── */}
      <div className={cn(
        "relative z-10 border-b border-border",
        collapsed ? "py-3 px-2" : "py-3 px-4"
      )}>
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center
                       text-white text-xs font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
          >
            {orgName.charAt(0).toUpperCase()}
          </div>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.25 }}
                className="min-w-0 overflow-hidden"
              >
                <p className="text-sm font-semibold text-foreground truncate leading-tight">
                  {orgName}
                </p>
                <span className={cn(
                  "mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap",
                  PLAN_STYLES[planTier]
                )}>
                  {PLAN_LABELS[planTier]}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="relative z-10 flex-1 overflow-y-auto py-3 px-2 space-y-0.5
                      scrollbar-thin scrollbar-thumb-brand-teal/20 scrollbar-track-transparent">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const isLocked = item.premiumOnly && !hasPremium;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={isLocked ? "/configuracoes/upgrade" : item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150",
                collapsed ? "px-0 py-2 justify-center" : "px-3 py-2.5",
                isActive
                  ? "bg-brand-teal/10 text-brand-teal dark:bg-brand-teal/15"
                  : isLocked
                  ? "text-muted-foreground/40 cursor-default"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {/* Active bar */}
              {isActive && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand-teal rounded-r-full"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}

              <Icon className={cn(
                "flex-shrink-0",
                collapsed ? "w-5 h-5" : "w-4.5 h-4.5",
                isActive ? "text-brand-teal" : ""
              )} size={collapsed ? 20 : 18} />

              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 truncate overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {!collapsed && item.badge && (
                <span className="ml-auto flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full
                                 bg-brand-teal/20 text-brand-teal">
                  {item.badge}
                </span>
              )}

              {!collapsed && isLocked && (
                <Lock className="ml-auto flex-shrink-0 w-3.5 h-3.5 text-muted-foreground/40" />
              )}

              {/* Collapsed tooltip */}
              {collapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg
                               bg-popover border border-border shadow-lg
                               text-sm font-medium text-foreground whitespace-nowrap
                               pointer-events-none opacity-0 group-hover:opacity-100
                               transition-opacity duration-150 z-50">
                  {item.label}
                  {item.badge && (
                    <span className="ml-1.5 text-[10px] text-brand-teal">{item.badge}</span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="relative z-10 border-t border-border p-2 space-y-0.5">
        <Link
          href="/configuracoes"
          title={collapsed ? "Configurações" : undefined}
          className={cn(
            "group relative flex items-center gap-3 rounded-xl text-sm font-medium",
            "text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
            collapsed ? "px-0 py-2 justify-center" : "px-3 py-2.5"
          )}
        >
          <Settings size={18} className="flex-shrink-0" />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Configurações
              </motion.span>
            )}
          </AnimatePresence>

          {collapsed && (
            <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg
                           bg-popover border border-border shadow-lg text-sm font-medium
                           text-foreground whitespace-nowrap pointer-events-none
                           opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
              Configurações
            </div>
          )}
        </Link>

        {/* User card */}
        <div className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2",
          collapsed && "justify-center px-0"
        )}>
          <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden
                         ring-2 ring-border bg-muted flex items-center justify-center">
            {userAvatar ? (
              <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-white"
                style={{ background: "linear-gradient(135deg, #41C5C6, #09254D)" }}>
                {userName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="min-w-0 overflow-hidden"
              >
                <p className="text-sm font-medium text-foreground truncate leading-tight">
                  {userName}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {PLAN_LABELS[planTier]}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
}
