/**
 * Hïve Event Bus — Mesh Thinking Core
 *
 * Nenhum dado é isolado. Todo evento ecoa pela rede.
 * Emita um evento → múltiplos handlers reagem de forma desacoplada.
 */

export type HiveEventType =
  // Projetos
  | "PROJECT_CREATED"
  | "PROJECT_ACTIVATED"
  | "PROJECT_COMPLETED"
  | "PROJECT_PAUSED"
  | "PROJECT_CANCELLED"

  // Membros — ciclo de vida
  | "MEMBER_JOINED"
  | "MEMBER_LEFT"
  | "MEMBER_ROLE_CHANGED"
  | "TASK_COMPLETED"
  | "SKILL_UPDATED"

  // Pontos
  | "POINTS_AWARDED"
  | "POINTS_DEDUCTED"

  // Inteligência
  | "DISCORD_SENTIMENT_ALERT"
  | "EXPERT_IDENTIFIED"
  | "BACKUP_REQUESTED"

  // Reuniões
  | "MEETING_AUDIO_UPLOADED"
  | "MEETING_MINUTES_GENERATED"

  // Financeiro
  | "EXPENSE_SUBMITTED"
  | "EXPENSE_APPROVED"
  | "EXPENSE_REJECTED"

  // Administrativo
  | "ORG_PLAN_CHANGED"
  | "INTEGRATION_CONNECTED"
  | "INTEGRATION_DISCONNECTED";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler = (payload: any) => Promise<void>;

class HiveEventBus {
  private handlers = new Map<HiveEventType, EventHandler[]>();

  /** Registrar um handler para um tipo de evento */
  on(event: HiveEventType, handler: EventHandler) {
    const existing = this.handlers.get(event) ?? [];
    this.handlers.set(event, [...existing, handler]);
    return this; // chainable
  }

  /**
   * Emite um evento para todos os handlers registrados.
   * Falhas individuais são logadas mas não bloqueiam outros handlers.
   */
  async emit<T = unknown>(event: HiveEventType, payload: T): Promise<void> {
    const handlers = this.handlers.get(event) ?? [];

    if (handlers.length === 0) {
      console.debug(`[HiveEventBus] No handlers registered for "${event}"`);
      return;
    }

    console.info(`[HiveEventBus] Emitting "${event}" → ${handlers.length} handler(s)`);

    const results = await Promise.allSettled(
      handlers.map((handler) => handler(payload))
    );

    // Log failures without throwing
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        console.error(
          `[HiveEventBus] Handler ${i} failed for event "${event}":`,
          result.reason
        );
        // TODO: persist to audit_logs table
      }
    });
  }

  /** Remove all handlers (useful in tests) */
  clear() {
    this.handlers.clear();
  }
}

// Singleton — um barramento para toda a aplicação
export const eventBus = new HiveEventBus();
