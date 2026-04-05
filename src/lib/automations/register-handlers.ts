/**
 * ─────────────────────────────────────────────────────────────
 *  Hïve — Central Handler Registration
 *
 *  Chame `registerAllHandlers()` uma vez no início de cada
 *  processo (ex: em route handlers, cron, middleware).
 *  É idempotente — o eventBus deduplica registros.
 * ─────────────────────────────────────────────────────────────
 */

import { eventBus } from "@/lib/events/event-bus";

let registered = false;

export async function registerAllHandlers() {
  if (registered) return; // idempotente no processo Node
  registered = true;

  // Lazy imports para não carregar tudo no cold start
  const [
    { handleProjectCreated },
    { handleMemberJoined },
    { handleMemberLeft },
  ] = await Promise.all([
    import("@/lib/automations/handlers/project-created"),
    import("@/lib/automations/handlers/member-joined"),
    import("@/lib/automations/handlers/member-left"),
  ]);

  eventBus.on("PROJECT_CREATED", handleProjectCreated as (payload: unknown) => Promise<void>);
  eventBus.on("MEMBER_JOINED", handleMemberJoined as (payload: unknown) => Promise<void>);
  eventBus.on("MEMBER_LEFT", handleMemberLeft as (payload: unknown) => Promise<void>);

  console.info("[Hïve] ✅ Event handlers registrados: PROJECT_CREATED, MEMBER_JOINED, MEMBER_LEFT");
}
