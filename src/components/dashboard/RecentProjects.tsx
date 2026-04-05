import Link from "next/link";
import { ArrowRight, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type ProjectStatus = "prospecting" | "proposal" | "negotiation" | "active" | "completed" | "cancelled";

interface Project {
  id: string;
  name: string;
  client_name: string;
  status: ProjectStatus;
  value: number;
  updated_at: string;
}

const statusConfig: Record<ProjectStatus, { label: string; dot: string; cls: string }> = {
  prospecting: { label: "Prospecção", dot: "bg-slate-400",                cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  proposal:    { label: "Proposta",   dot: "bg-blue-400",                 cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  negotiation: { label: "Negociação", dot: "bg-brand-yellow",             cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  active:      { label: "Ativo",      dot: "bg-brand-teal",               cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-brand-teal" },
  completed:   { label: "Concluído",  dot: "bg-emerald-500",              cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  cancelled:   { label: "Cancelado",  dot: "bg-red-400",                  cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

export function RecentProjects({ projects }: { projects: Project[] }) {
  return (
    <div className="card-brand p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Projetos Recentes</h3>
        <Link href="/projetos"
          className="flex items-center gap-1 text-xs text-brand-teal hover:text-brand-teal/80 font-medium transition-colors">
          Ver todos
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-teal/10 flex items-center justify-center mb-3">
            <FolderOpen className="w-6 h-6 text-brand-teal" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Nenhum projeto ainda</p>
          <p className="text-xs text-muted-foreground mb-4">Inicie o primeiro projeto da sua EJ</p>
          <Link
            href="/projetos/novo"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-brand hover:opacity-90 transition-opacity"
          >
            Criar projeto
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {projects.map((project) => {
            const s = statusConfig[project.status];
            return (
              <Link
                key={project.id}
                href={`/projetos/${project.id}`}
                className="group flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-all duration-150"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-brand-teal/10 dark:bg-brand-teal/15
                                  flex items-center justify-center flex-shrink-0 text-sm">
                    📋
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate
                                  group-hover:text-brand-teal transition-colors">
                      {project.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{project.client_name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <span className={cn("flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium", s.cls)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", s.dot)} />
                    {s.label}
                  </span>
                  <span className="text-sm font-semibold text-foreground hidden sm:block tabular-nums">
                    R$ {project.value.toLocaleString("pt-BR")}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
