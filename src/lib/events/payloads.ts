/**
 * Hïve Event Payloads — Tipagem de todos os eventos do sistema
 */

export interface ProjectCreatedPayload {
  projectId: string;
  orgId: string;
  project: {
    name: string;
    slug: string;
    clientName: string;
    clientEmail?: string;
    clientContext: string;
    value: number;
    startDate?: string;
    endDate?: string;
    requiredSkills: string[];
    estimatedHours?: number;
  };
  team: MemberProfile[];
  leaderId?: string;
  enabledIntegrations: EnabledIntegrations;
  autoAllocate: boolean;
  scheduleKickoff: boolean;
}

export interface ProjectActivatedPayload {
  projectId: string;
  orgId: string;
  projectName: string;
  externalIds: ExternalIds;
  team: MemberProfile[];
}

export interface ProjectCompletedPayload {
  projectId: string;
  orgId: string;
  projectName: string;
  clientName: string;
  value: number;
  externalIds: ExternalIds;
  team: MemberProfile[];
  finalNps?: number;
}

export interface ProjectPausedPayload {
  projectId: string;
  orgId: string;
  projectName: string;
  clientName: string;
  reason?: string;
  externalIds: ExternalIds;
  team: MemberProfile[];
}

export interface TaskCompletedPayload {
  taskId: string;           // ClickUp task ID
  taskName: string;
  taskCategory: string;     // "Design" | "Dev" | "Gestão" | etc.
  orgId: string;
  projectId?: string;
  assigneeEmail: string;
  completedOnTime: boolean;
  completedEarly: boolean;
  clickupListId: string;
}

export interface PointsPayload {
  orgId: string;
  userId: string;
  userName: string;
  amount: number;
  reason: string;
  sourceEvent: string;
  projectId?: string;
}

export interface SentimentPayload {
  orgId: string;
  projectId: string;
  discordChannelId: string;
  sentiment: "positive" | "neutral" | "concerned" | "negative";
  score: number;            // -1 to 1
  sampleMessages: string[]; // For GPT context
  leaderId?: string;
  leaderDiscordId?: string;
}

export interface ExpertIdentifiedPayload {
  orgId: string;
  userId: string;
  userName: string;
  category: string;
  taskCount: number;
  badgeName: string;
}

export interface BackupRequestedPayload {
  projectId: string;
  orgId: string;
  projectName: string;
  requestedBy: string;
  externalIds: ExternalIds;
}

// Shared types
export interface MemberProfile {
  id: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string;
  discordId?: string;
  googleCalendarId?: string;
  skills: { skillName: string; level: number }[];
  completedProjects: number;
}

export interface ExternalIds {
  driveFolderId?: string;
  driveDocId?: string;
  discordChannelId?: string;
  discordRoleId?: string;
  clickupListId?: string;
  notionPageId?: string;
  miroBoardId?: string;
  calendarEventId?: string;
}

export interface EnabledIntegrations {
  googleDrive: boolean;
  googleDocs: boolean;
  googleCalendar: boolean;
  discord: boolean;
  clickup: boolean;
  notion: boolean;
  miro: boolean;
}

export const DEFAULT_INTEGRATIONS: EnabledIntegrations = {
  googleDrive: true,
  googleDocs: true,
  googleCalendar: true,
  discord: true,
  clickup: true,
  notion: true,
  miro: false, // Miro é premium
};
