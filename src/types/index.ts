// ─────────────────────────────────────────────
//  Hï Tech Hub — Tipos Globais
// ─────────────────────────────────────────────

// ── Planos de assinatura ─────────────────────
export type PlanTier = "free" | "premium" | "internal";

// ── Empresa Júnior (tenant) ──────────────────
export interface Organization {
  id: string;
  name: string;
  slug: string;
  email_domain: string | null;
  logo_url: string | null;
  plan_tier: PlanTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Usuário ──────────────────────────────────
export type UserRole = "owner" | "admin" | "member" | "viewer";

export interface UserProfile {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  skills: Skill[];
  is_active: boolean;
  created_at: string;
}

// ── Competências ─────────────────────────────
export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  level: 1 | 2 | 3 | 4 | 5; // 1=básico, 5=expert
}

export type SkillCategory =
  | "tech"
  | "design"
  | "marketing"
  | "finance"
  | "management"
  | "communication"
  | "other";

// ── Projetos ─────────────────────────────────
export type ProjectStatus =
  | "prospecting"
  | "proposal"
  | "negotiation"
  | "active"
  | "completed"
  | "cancelled";

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  client_name: string;
  status: ProjectStatus;
  value: number;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  nps_score: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // relations
  allocations?: ProjectAllocation[];
}

export interface ProjectAllocation {
  id: string;
  project_id: string;
  user_id: string;
  role_in_project: string;
  hours_per_week: number;
  start_date: string;
  end_date: string | null;
  // relations
  user?: UserProfile;
}

// ── KPIs Brasil Júnior ───────────────────────
export interface BrazilJuniorKPIs {
  organization_id: string;
  period: string; // YYYY-MM
  revenue: number;
  projects_count: number;
  active_members: number;
  nps_average: number | null;
  satisfaction_rate: number | null;
  recorded_at: string;
}

// ── Wiki / Passagem de Bastão ─────────────────
export interface WikiArticle {
  id: string;
  organization_id: string;
  title: string;
  content: string; // markdown
  role_tag: string | null;   // cargo relacionado
  author_id: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// ── Documentos / Contratos ───────────────────
export type DocumentType = "contract" | "proposal" | "nda" | "other";
export type DocumentStatus = "draft" | "sent" | "signed" | "cancelled";

export interface Document {
  id: string;
  organization_id: string;
  project_id: string | null;
  type: DocumentType;
  status: DocumentStatus;
  title: string;
  template_data: Record<string, unknown>; // dados do formulário
  pdf_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ── Integrações OAuth ────────────────────────
export type IntegrationProvider =
  | "google"
  | "clickup"
  | "notion"
  | "discord"
  | "canva"
  | "figma";

export interface Integration {
  id: string;
  organization_id: string;
  provider: IntegrationProvider;
  access_token: string;      // criptografado no banco
  refresh_token: string | null;
  token_expires_at: string | null;
  external_workspace_id: string | null;
  is_active: boolean;
  connected_by: string;
  connected_at: string;
}

// ── API responses ────────────────────────────
export interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}
