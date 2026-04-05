// ─────────────────────────────────────────────────────────────
//  Google Calendar Integration
//  Verifica disponibilidade de membros para alocação
// ─────────────────────────────────────────────────────────────

import { google } from "googleapis";

export interface CalendarAvailability {
  memberId: string;
  freeSlots: { start: string; end: string }[];
  busySlots: { start: string; end: string }[];
  conflictCount: number;
}

/**
 * Verifica disponibilidade de um membro via Google Calendar (FreeBusy API).
 * Retorna slots livres/ocupados no período dado.
 */
export async function getCalendarAvailability(
  accessToken: string,
  memberId: string,
  startDate: string,
  endDate: string
): Promise<CalendarAvailability> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: "v3", auth });

  const freeBusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: new Date(startDate).toISOString(),
      timeMax: new Date(endDate).toISOString(),
      timeZone: "America/Sao_Paulo",
      items: [{ id: "primary" }], // calendário principal do usuário
    },
  });

  const busy = freeBusy.data.calendars?.["primary"]?.busy ?? [];

  return {
    memberId,
    freeSlots: [], // calculado por demanda
    busySlots: busy.map((b) => ({ start: b.start!, end: b.end! })),
    conflictCount: busy.length,
  };
}

/**
 * Cria evento no Google Calendar para kickoff de projeto.
 */
export async function createProjectEvent(opts: {
  accessToken: string;
  projectName: string;
  clientName: string;
  startDateTime: string;
  endDateTime: string;
  attendeeEmails: string[];
  description?: string;
}) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: opts.accessToken });
  const calendar = google.calendar({ version: "v3", auth });

  return calendar.events.insert({
    calendarId: "primary",
    sendUpdates: "all",
    requestBody: {
      summary: `[Kickoff] ${opts.projectName} — ${opts.clientName}`,
      description: opts.description ?? `Reunião de kickoff do projeto ${opts.projectName} com ${opts.clientName}.`,
      start: { dateTime: opts.startDateTime, timeZone: "America/Sao_Paulo" },
      end: { dateTime: opts.endDateTime, timeZone: "America/Sao_Paulo" },
      attendees: opts.attendeeEmails.map((email) => ({ email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 1440 }, // 24h antes
          { method: "popup", minutes: 30 },
        ],
      },
    },
  });
}

/**
 * Sincroniza eventos do calendário da organização (últimos 30 dias + próximos 60).
 */
export async function syncOrgCalendar(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth });

  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 30);

  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 60);

  const events = await calendar.events.list({
    calendarId: "primary",
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 100,
  });

  return events.data.items ?? [];
}
