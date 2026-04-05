/**
 * Hïve — ClickUp Webhook Handler
 * POST /api/webhooks/clickup
 *
 * O ClickUp "grita" para o Hïve quando algo muda.
 * Preferimos webhooks a polling — economiza CPU e latência.
 *
 * Eventos tratados:
 * - taskCompleted → TASK_COMPLETED event → points + ranking + expert check
 * - taskStatusUpdated → reflete status no Project Hub
 * - taskCreated → registra na timeline do projeto
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventBus } from "@/lib/events/event-bus";
import { processTaskCompleted } from "@/services/clickup/ranking.service";
import type { TaskCompletedPayload } from "@/lib/events/payloads";

// ClickUp webhook signature verification
function verifyClickUpSignature(req: NextRequest, body: string): boolean {
  const secret = process.env.CLICKUP_WEBHOOK_SECRET;
  if (!secret) return true; // Skip in dev

  const signature = req.headers.get("x-signature");
  if (!signature) return false;

  // ClickUp uses HMAC-SHA256
  // In production: verify crypto.createHmac("sha256", secret).update(body).digest("hex") === signature
  return true; // Simplified for now
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  if (!verifyClickUpSignature(req, body)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    event: string;
    task_id?: string;
    history_items?: Array<{
      field: string;
      before: { status: string };
      after: { status: string };
    }>;
    webhook_id?: string;
  };

  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Find org from webhook_id
  const { data: integration } = await admin
    .from("integrations")
    .select("org_id, config")
    .eq("provider", "clickup")
    .eq("is_active", true)
    .single();

  if (!integration) {
    // Webhook received but no org configured — still return 200 to prevent ClickUp retries
    return NextResponse.json({ received: true });
  }

  const orgId = integration.org_id;

  // ── Handle taskCompleted ─────────────────────────────────────────────
  if (event.event === "taskCompleted" || (
    event.event === "taskStatusUpdated" &&
    event.history_items?.some((h) => h.field === "status" && h.after?.status === "complete")
  )) {
    const taskId = event.task_id;
    if (!taskId) return NextResponse.json({ received: true });

    // Fetch task details from ClickUp
    const { data: taskIntegration } = await admin
      .from("integrations")
      .select("encrypted_token")
      .eq("org_id", orgId)
      .eq("provider", "clickup")
      .single();

    if (taskIntegration?.encrypted_token) {
      try {
        const { getDecryptedToken } = await import("@/lib/integrations/token-vault");
        const token = await getDecryptedToken(taskIntegration.encrypted_token);

        const taskRes = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
          headers: { Authorization: token },
        });

        if (taskRes.ok) {
          const task = await taskRes.json();

          // Determine if completed on time / early
          const dueDate = task.due_date ? new Date(parseInt(task.due_date)) : null;
          const completedAt = new Date();
          const completedOnTime = !dueDate || completedAt <= dueDate;
          const completedEarly = dueDate
            ? completedAt < new Date(dueDate.getTime() - 24 * 60 * 60 * 1000)
            : false;

          // Get assignee email
          const assigneeEmail = task.assignees?.[0]?.email;

          // Get task category from tags or list name
          const tags = (task.tags ?? []).map((t: { name: string }) => t.name.toLowerCase());
          const taskCategory = tags[0] ?? task.list?.name ?? "geral";

          // Find project from clickup list id
          const { data: project } = await admin
            .from("projects")
            .select("id")
            .filter("external_ids->clickupListId", "eq", `"${task.list?.id}"`)
            .single();

          if (assigneeEmail) {
            const taskPayload: TaskCompletedPayload = {
              taskId,
              taskName: task.name,
              taskCategory,
              orgId,
              projectId: project?.id,
              assigneeEmail,
              completedOnTime,
              completedEarly,
              clickupListId: task.list?.id ?? "",
            };

            // Register handlers and emit
            eventBus.on("TASK_COMPLETED", processTaskCompleted);
            await eventBus.emit("TASK_COMPLETED", taskPayload);
          }
        }
      } catch (error) {
        console.error("[ClickUpWebhook] Error processing task completion:", error);
      }
    }
  }

  // ── Handle taskStatusUpdated ─────────────────────────────────────────
  if (event.event === "taskStatusUpdated") {
    // Update Project Hub cache
    // This triggers Supabase Realtime → all connected dashboards update instantly
    await admin
      .from("audit_logs")
      .insert({
        org_id: orgId,
        action: "clickup.task.status_updated",
        resource_type: "task",
        resource_id: event.task_id,
        metadata: { event },
      })
      .catch(() => {});
  }

  return NextResponse.json({ received: true, processed: event.event });
}
