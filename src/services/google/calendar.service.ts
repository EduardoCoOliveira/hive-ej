/**
 * Hïve — Google Calendar Service
 * Smart scheduling: encontra o melhor horário sem conflitos para toda a equipe
 */

import { getDecryptedToken } from "@/lib/integrations/token-vault";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MemberProfile } from "@/lib/events/payloads";

interface CalendarCredentials {
  access_token: string;
}

interface TimeSlot {
  start: string; // ISO string
  end: string;   // ISO string
}

export interface BestMeetingSlot {
  start: string;
  end: string;
  availabilityPercent: number; // % of team available
  availableMembers: string[];
  unavailableMembers: string[];
}

async function getCalendarCredentials(orgId: string): Promise<CalendarCredentials | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("integrations")
    .select("encrypted_token")
    .eq("org_id", orgId)
    .eq("provider", "google")
    .eq("is_active", true)
    .single();

  if (!data?.encrypted_token) return null;
  const decrypted = await getDecryptedToken(data.encrypted_token);
  const parsed = JSON.parse(decrypted);
  return { access_token: parsed.access_token };
}

/**
 * Encontra os melhores horários para uma reunião com toda a equipe.
 * Usa Google Calendar FreeBusy API para checar disponibilidade real.
 *
 * Retorna top 3 slots ordenados por % de disponibilidade do time.
 */
export async function findBestMeetingSlots(
  orgId: string,
  members: MemberProfile[],
  durationMinutes: number = 60,
  lookAheadDays: number = 7
): Promise<BestMeetingSlot[]> {
  const credentials = await getCalendarCredentials(orgId);
  if (!credentials) {
    console.warn(`[CalendarService] No Google credentials for org ${orgId}`);
    return [];
  }

  const now = new Date();
  const timeMin = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
  const timeMax = new Date(now.getTime() + lookAheadDays * 24 * 60 * 60 * 1000);

  // Get busy times for all members
  const calendarIds = members
    .filter((m) => m.googleCalendarId || m.email)
    .map((m) => ({ id: m.googleCalendarId ?? m.email }));

  if (calendarIds.length === 0) return [];

  try {
    const freeBusyRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone: "America/Sao_Paulo",
        items: calendarIds,
      }),
    });

    if (!freeBusyRes.ok) {
      console.error(`[CalendarService] FreeBusy API error: ${freeBusyRes.status}`);
      return [];
    }

    const freeBusyData = await freeBusyRes.json();

    // Collect all busy periods per member email
    const busyByMember: Record<string, TimeSlot[]> = {};
    calendarIds.forEach(({ id }) => {
      busyByMember[id] = freeBusyData.calendars?.[id]?.busy ?? [];
    });

    // Generate candidate slots (9h-18h, weekdays only)
    const candidateSlots = generateCandidateSlots(timeMin, timeMax, durationMinutes);

    // Score each slot
    const scoredSlots = candidateSlots.map((slot) => {
      const available: string[] = [];
      const unavailable: string[] = [];

      members.forEach((member) => {
        const calId = member.googleCalendarId ?? member.email;
        const busy = busyByMember[calId] ?? [];
        const hasConflict = busy.some((b) =>
          new Date(b.start) < new Date(slot.end) &&
          new Date(b.end) > new Date(slot.start)
        );

        if (hasConflict) {
          unavailable.push(member.fullName);
        } else {
          available.push(member.fullName);
        }
      });

      return {
        ...slot,
        availabilityPercent: members.length > 0
          ? Math.round((available.length / members.length) * 100)
          : 100,
        availableMembers: available,
        unavailableMembers: unavailable,
      };
    });

    // Return top 3 slots sorted by availability
    return scoredSlots
      .sort((a, b) => b.availabilityPercent - a.availabilityPercent)
      .slice(0, 3);
  } catch (error) {
    console.error(`[CalendarService] Error finding meeting slots:`, error);
    return [];
  }
}

/**
 * Agenda o kickoff do projeto no Google Calendar
 */
export async function scheduleProjectKickoff(
  orgId: string,
  slot: BestMeetingSlot,
  projectName: string,
  projectId: string,
  attendeeEmails: string[]
): Promise<string | null> {
  const credentials = await getCalendarCredentials(orgId);
  if (!credentials) return null;

  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: `🚀 Kickoff — ${projectName}`,
        description: `Reunião de kickoff do projeto ${projectName}.\n\nOrganizado automaticamente pelo Hïve.\nID do projeto: ${projectId}`,
        start: { dateTime: slot.start, timeZone: "America/Sao_Paulo" },
        end: { dateTime: slot.end, timeZone: "America/Sao_Paulo" },
        attendees: attendeeEmails.map((email) => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },  // 1 day before
            { method: "popup", minutes: 30 },
          ],
        },
        conferenceData: {
          createRequest: {
            requestId: `hive-kickoff-${projectId}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[CalendarService] Failed to create kickoff event: ${err}`);
      return null;
    }

    const event = await res.json();
    console.info(`[CalendarService] Kickoff scheduled: ${event.id} for "${projectName}"`);
    return event.id;
  } catch (error) {
    console.error(`[CalendarService] Error scheduling kickoff:`, error);
    return null;
  }
}

// ── Internal helpers ────────────────────────────────────────────────────────

function generateCandidateSlots(
  from: Date,
  to: Date,
  durationMinutes: number
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const current = new Date(from);

  // Round up to next 9h
  current.setHours(9, 0, 0, 0);
  if (current < from) {
    current.setDate(current.getDate() + 1);
    current.setHours(9, 0, 0, 0);
  }

  while (current < to) {
    const dayOfWeek = current.getDay();
    // Skip weekends
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Generate slots from 9h to 18h
      const endOfDay = new Date(current);
      endOfDay.setHours(18, 0, 0, 0);

      const slotStart = new Date(current);
      while (slotStart < endOfDay) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);
        if (slotEnd <= endOfDay) {
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
          });
        }
        slotStart.setTime(slotStart.getTime() + durationMinutes * 60 * 1000);
      }
    }

    // Next day
    current.setDate(current.getDate() + 1);
    current.setHours(9, 0, 0, 0);
  }

  return slots;
}
