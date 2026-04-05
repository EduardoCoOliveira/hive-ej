"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";

type SkillLevel = 0 | 1 | 2 | 3 | 4 | 5;
type SkillCategory = "technical" | "design" | "management" | "business" | "soft";

interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
}

interface MemberSkill {
  skill_id: string;
  level: SkillLevel;
}

interface Member {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  skills: MemberSkill[];
}

interface AllocationSuggestion {
  memberId: string;
  memberName: string;
  score: number;
  skillScore: number;
  availabilityScore: number;
  experienceScore: number;
  justification?: string;
}

const CATEGORY_LABELS: Record<SkillCategory, { label: string; color: string; icon: string }> = {
  technical:  { label: "Técnico",    color: "#2563EB", icon: "⚙️" },
  design:     { label: "Design",     color: "#7C3AED", icon: "🎨" },
  management: { label: "Gestão",     color: "#0891B2", icon: "📋" },
  business:   { label: "Negócios",   color: "#D97706", icon: "💼" },
  soft:       { label: "Soft Skills",color: "#16A34A", icon: "🤝" },
};

const LEVEL_LABELS: Record<SkillLevel, { label: string; color: string }> = {
  0: { label: "—",           color: "#E5E7EB" },
  1: { label: "Iniciante",   color: "#FEF9C3" },
  2: { label: "Básico",      color: "#FEF08A" },
  3: { label: "Intermediário", color: "#86EFAC" },
  4: { label: "Avançado",    color: "#4ADE80" },
  5: { label: "Especialista", color: "#16A34A" },
};

function LevelDot({ level, size = "sm" }: { level: SkillLevel; size?: "sm" | "lg" }) {
  const sz = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  if (level === 0) return (
    <div className={`${sz} rounded-full border border-border bg-transparent`} />
  );
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center text-[9px] font-bold text-gray-800`}
      style={{ background: LEVEL_LABELS[level].color }}
      title={LEVEL_LABELS[level].label}
    >
      {level}
    </div>
  );
}

export default function CompetenciasPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<Member[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<SkillCategory | "all">("all");
  const [view, setView] = useState<"matrix" | "suggest">("matrix");
  const [searchTerm, setSearchTerm] = useState("");

  // Allocation suggester state
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [hoursPerWeek, setHoursPerWeek] = useState("10");
  const [suggestions, setSuggestions] = useState<AllocationSuggestion[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [{ data: membersData }, { data: skillsData }] = await Promise.all([
      supabase
        .from("profiles")
        .select(`
          id, full_name, avatar_url, role,
          skills:member_skills(skill_id, level)
        `)
        .eq("is_active", true)
        .order("full_name"),
      supabase
        .from("skills")
        .select("id, name, category")
        .eq("is_active", true)
        .order("category")
        .order("name"),
    ]);

    setMembers((membersData ?? []).map((m) => ({
      ...m,
      skills: m.skills ?? [],
    })));
    setSkills(skillsData ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredSkills = skills.filter((s) => {
    const catMatch = activeCategory === "all" || s.category === activeCategory;
    const searchMatch = !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase());
    return catMatch && searchMatch;
  });

  const filteredMembers = members.filter((m) =>
    !searchTerm || m.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function getMemberSkillLevel(member: Member, skillId: string): SkillLevel {
    const ms = member.skills.find((s) => s.skill_id === skillId);
    return (ms?.level ?? 0) as SkillLevel;
  }

  function getCoveragePercent(skillId: string): number {
    const skilled = members.filter((m) => getMemberSkillLevel(m, skillId) > 0);
    return members.length > 0 ? Math.round((skilled.length / members.length) * 100) : 0;
  }

  function getMemberAvgLevel(member: Member): number {
    const nonZero = member.skills.filter((s) => s.level > 0);
    if (nonZero.length === 0) return 0;
    return nonZero.reduce((sum, s) => sum + s.level, 0) / nonZero.length;
  }

  async function handleSuggest() {
    if (selectedSkills.length === 0) return;
    setSuggestLoading(true);
    try {
      const res = await fetch("/api/competencias/sugestoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requiredSkills: selectedSkills,
          hoursPerWeek: parseInt(hoursPerWeek),
        }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch {
      setSuggestions([]);
    }
    setSuggestLoading(false);
  }

  // Categories with skill counts
  const categories = (["all", ...Object.keys(CATEGORY_LABELS)] as (SkillCategory | "all")[]).map((cat) => ({
    key: cat,
    label: cat === "all" ? "Todas" : CATEGORY_LABELS[cat as SkillCategory].label,
    count: cat === "all" ? skills.length : skills.filter((s) => s.category === cat).length,
  }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Competências"
        subtitle={`${members.length} membros · ${skills.length} habilidades mapeadas`}
        userName=""
        userEmail=""
        planTier="premium"
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card flex-wrap">
        {/* View toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          {([
            { key: "matrix", label: "📊 Matriz" },
            { key: "suggest", label: "✨ Sugerir Alocação" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                view === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {view === "matrix" && (
          <>
            {/* Search */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">🔍</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar membro ou habilidade..."
                className="pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-teal/40 w-52"
              />
            </div>

            {/* Category filter */}
            <div className="flex items-center gap-1 flex-wrap">
              {categories.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    activeCategory === key
                      ? "bg-brand-teal/10 text-brand-teal border border-brand-teal/30"
                      : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label} {count > 0 && <span className="opacity-70">({count})</span>}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="ml-auto text-xs text-muted-foreground">
          {filteredSkills.length} habilidades · {filteredMembers.length} membros
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">

          {/* ── SKILL MATRIX ── */}
          {view === "matrix" && (
            <div className="p-6">
              {filteredMembers.length === 0 || filteredSkills.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <span className="text-4xl mb-2">🧩</span>
                  <p className="text-muted-foreground font-medium">Nenhum dado para exibir</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Adicione membros e habilidades para visualizar a matriz
                  </p>
                </div>
              ) : (
                <>
                  {/* Legend */}
                  <div className="flex items-center gap-4 mb-5 flex-wrap">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nível:</span>
                    {([0, 1, 2, 3, 4, 5] as SkillLevel[]).map((lvl) => (
                      <div key={lvl} className="flex items-center gap-1.5">
                        <LevelDot level={lvl} />
                        <span className="text-xs text-muted-foreground">{LEVEL_LABELS[lvl].label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Matrix table */}
                  <div className="bg-card border border-border rounded-2xl overflow-auto">
                    <table className="min-w-max w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          {/* Empty top-left cell */}
                          <th className="sticky left-0 bg-card z-10 text-left px-4 py-3 min-w-48 border-r border-border">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Membro</span>
                          </th>
                          {filteredSkills.map((skill) => {
                            const cat = CATEGORY_LABELS[skill.category];
                            const coverage = getCoveragePercent(skill.id);
                            return (
                              <th key={skill.id} className="px-2 py-2 text-center min-w-24">
                                <div className="flex flex-col items-center gap-1">
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                                    style={{ background: cat.color + "20", color: cat.color }}
                                  >
                                    {cat.icon}
                                  </span>
                                  <span className="font-medium text-foreground leading-tight text-center max-w-20 break-words">
                                    {skill.name}
                                  </span>
                                  <div
                                    className="w-12 h-1 rounded-full bg-muted overflow-hidden"
                                    title={`${coverage}% dos membros têm esta skill`}
                                  >
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${coverage}%`, background: "#41C5C6" }}
                                    />
                                  </div>
                                </div>
                              </th>
                            );
                          })}
                          <th className="px-3 py-3 text-center min-w-20 border-l border-border">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Média</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMembers.map((member, i) => {
                          const avg = getMemberAvgLevel(member);
                          return (
                            <tr
                              key={member.id}
                              className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${
                                i % 2 === 0 ? "" : "bg-muted/10"
                              }`}
                            >
                              {/* Member cell */}
                              <td className="sticky left-0 bg-card z-10 px-4 py-3 border-r border-border">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                    style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
                                  >
                                    {member.avatar_url ? (
                                      <img src={member.avatar_url} alt={member.full_name} className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                      member.full_name.charAt(0)
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-foreground truncate">{member.full_name}</p>
                                    <p className="text-[10px] text-muted-foreground capitalize">{member.role}</p>
                                  </div>
                                </div>
                              </td>

                              {/* Skill cells */}
                              {filteredSkills.map((skill) => {
                                const level = getMemberSkillLevel(member, skill.id);
                                return (
                                  <td key={skill.id} className="px-2 py-3 text-center">
                                    <div className="flex justify-center">
                                      <LevelDot level={level} />
                                    </div>
                                  </td>
                                );
                              })}

                              {/* Avg */}
                              <td className="px-3 py-3 text-center border-l border-border">
                                <span
                                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    avg >= 4 ? "bg-green-100 text-green-700" :
                                    avg >= 2.5 ? "bg-yellow-100 text-yellow-700" :
                                    avg > 0 ? "bg-gray-100 text-gray-600" :
                                    "text-muted-foreground"
                                  }`}
                                >
                                  {avg > 0 ? avg.toFixed(1) : "—"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Coverage summary row */}
                  <div className="mt-4 p-4 bg-card border border-border rounded-xl">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Cobertura por categoria</p>
                    <div className="flex gap-4 flex-wrap">
                      {Object.entries(CATEGORY_LABELS).map(([cat, meta]) => {
                        const catSkills = skills.filter((s) => s.category === cat as SkillCategory);
                        const covered = catSkills.reduce((sum, s) => sum + getCoveragePercent(s.id), 0);
                        const avg = catSkills.length > 0 ? Math.round(covered / catSkills.length) : 0;
                        return (
                          <div key={cat} className="flex items-center gap-2">
                            <span>{meta.icon}</span>
                            <div>
                              <p className="text-xs font-medium text-foreground">{meta.label}</p>
                              <p className="text-[10px] text-muted-foreground">{avg}% cobertura</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── ALLOCATION SUGGESTER ── */}
          {view === "suggest" && (
            <div className="p-6">
              <div className="grid grid-cols-3 gap-6">
                {/* Left: form */}
                <div className="col-span-1 space-y-4">
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Parâmetros de Busca</h3>

                    {/* Skill selector */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                        Competências necessárias
                      </label>
                      <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
                        {skills.map((skill) => {
                          const cat = CATEGORY_LABELS[skill.category];
                          const selected = selectedSkills.includes(skill.id);
                          return (
                            <button
                              key={skill.id}
                              onClick={() =>
                                setSelectedSkills((prev) =>
                                  selected ? prev.filter((s) => s !== skill.id) : [...prev, skill.id]
                                )
                              }
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left ${
                                selected
                                  ? "border-brand-teal bg-brand-teal/5 text-foreground"
                                  : "border-border text-muted-foreground hover:border-border/80"
                              }`}
                            >
                              <span className="text-[10px]">{cat.icon}</span>
                              <span className="text-xs font-medium flex-1">{skill.name}</span>
                              {selected && <span className="text-brand-teal text-xs">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                      {selectedSkills.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {selectedSkills.length} competência{selectedSkills.length > 1 ? "s" : ""} selecionada{selectedSkills.length > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>

                    {/* Hours */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                        Disponibilidade mínima
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="4"
                          max="40"
                          step="2"
                          value={hoursPerWeek}
                          onChange={(e) => setHoursPerWeek(e.target.value)}
                          className="flex-1 accent-brand-teal"
                        />
                        <span className="text-sm font-semibold text-foreground w-16 text-right">{hoursPerWeek}h/sem</span>
                      </div>
                    </div>

                    <button
                      onClick={handleSuggest}
                      disabled={selectedSkills.length === 0 || suggestLoading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
                    >
                      {suggestLoading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          Analisando...
                        </>
                      ) : (
                        "✨ Sugerir Consultores"
                      )}
                    </button>
                  </div>

                  {/* Algorithm info */}
                  <div className="p-4 rounded-xl border border-border bg-card">
                    <p className="text-xs font-semibold text-foreground mb-2">Como funciona o algoritmo</p>
                    <div className="space-y-1.5">
                      {[
                        { label: "Compatibilidade de skills", pct: "60%", color: "#09254D" },
                        { label: "Disponibilidade (Calendar)", pct: "25%", color: "#4E378C" },
                        { label: "Experiência em projetos", pct: "15%", color: "#41C5C6" },
                      ].map(({ label, pct, color }) => (
                        <div key={label} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                          <span className="text-xs text-muted-foreground flex-1">{label}</span>
                          <span className="text-xs font-bold text-foreground">{pct}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                      O top resultado recebe uma justificativa gerada pelo GPT-4o explicando por que é o melhor fit.
                    </p>
                  </div>
                </div>

                {/* Right: results */}
                <div className="col-span-2">
                  {suggestions === null ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center bg-card border border-border rounded-2xl border-dashed">
                      <span className="text-4xl mb-3">✨</span>
                      <p className="text-sm font-medium text-muted-foreground">
                        Selecione as competências e clique em Sugerir Consultores
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        O algoritmo irá ranquear os membros por compatibilidade, disponibilidade e experiência
                      </p>
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center bg-card border border-border rounded-2xl">
                      <span className="text-4xl mb-3">😕</span>
                      <p className="text-sm font-medium text-foreground">Nenhum consultor encontrado</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Tente reduzir as horas mínimas ou ajustar as competências
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm font-semibold text-foreground">
                        {suggestions.length} consultor{suggestions.length > 1 ? "es" : ""} sugerido{suggestions.length > 1 ? "s" : ""}
                      </p>
                      {suggestions.map((sug, i) => {
                        const member = members.find((m) => m.id === sug.memberId);
                        return (
                          <div
                            key={sug.memberId}
                            className={`bg-card border rounded-2xl p-5 ${i === 0 ? "border-brand-teal/40 shadow-sm" : "border-border"}`}
                          >
                            <div className="flex items-start gap-4">
                              {/* Rank badge */}
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                                  i === 0 ? "text-white" : "bg-muted text-muted-foreground"
                                }`}
                                style={i === 0 ? { background: "linear-gradient(135deg, #09254D, #4E378C)" } : {}}
                              >
                                {i === 0 ? "★" : i + 1}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                    style={{ background: "linear-gradient(135deg, #09254D, #4E378C)" }}
                                  >
                                    {member?.avatar_url ? (
                                      <img src={member.avatar_url} alt={sug.memberName} className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                      sug.memberName.charAt(0)
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">{sug.memberName}</p>
                                    {i === 0 && (
                                      <span className="text-[10px] font-semibold text-brand-teal">🏆 Melhor match</span>
                                    )}
                                  </div>
                                  <div className="ml-auto flex items-center gap-1">
                                    <span className="text-lg font-bold" style={{ color: "#09254D" }}>
                                      {Math.round(sug.score * 100)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">pts</span>
                                  </div>
                                </div>

                                {/* Score breakdown */}
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                  {[
                                    { label: "Skills", val: sug.skillScore, color: "#09254D" },
                                    { label: "Disponibilidade", val: sug.availabilityScore, color: "#4E378C" },
                                    { label: "Experiência", val: sug.experienceScore, color: "#41C5C6" },
                                  ].map(({ label, val, color }) => (
                                    <div key={label} className="bg-muted/50 rounded-lg p-2 text-center">
                                      <p className="text-lg font-bold" style={{ color }}>{Math.round(val * 100)}</p>
                                      <p className="text-[10px] text-muted-foreground">{label}</p>
                                    </div>
                                  ))}
                                </div>

                                {/* GPT justification (only top result) */}
                                {i === 0 && sug.justification && (
                                  <div className="p-3 rounded-xl bg-brand-teal/5 border border-brand-teal/20">
                                    <p className="text-[10px] font-semibold text-brand-teal uppercase tracking-wide mb-1">
                                      ✨ Análise GPT-4o
                                    </p>
                                    <p className="text-xs text-foreground leading-relaxed">{sug.justification}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
