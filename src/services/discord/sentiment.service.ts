/**
 * Hïve — Discord Sentiment Analysis Service
 *
 * Monitora canais de projetos, analisa sentimento com GPT-4o,
 * e alerta o líder quando a equipe precisa de atenção.
 */

import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventBus } from "@/lib/events/event-bus";
import type { SentimentPayload } from "@/lib/events/payloads";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type SentimentScore = "positive" | "neutral" | "concerned" | "negative";

interface SentimentResult {
  sentiment: SentimentScore;
  score: number;          // -1 (very negative) to 1 (very positive)
  reasoning: string;
  suggestedAction?: string;
}

/**
 * Analisa o sentimento das últimas N mensagens de um canal Discord.
 * Se identificar "concerned" ou "negative" por tempo suficiente, dispara alerta.
 */
export async function analyzChannelSentiment(
  orgId: string,
  projectId: string,
  discordChannelId: string,
  messages: string[],
  leaderId?: string,
  leaderDiscordId?: string
): Promise<SentimentResult | null> {
  if (messages.length < 3) return null; // Not enough data

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Você é um analisador de sentimento especializado em times de Empresas Juniores.
          Analise as mensagens do canal de um projeto e retorne um JSON com:
          {
            "sentiment": "positive" | "neutral" | "concerned" | "negative",
            "score": número de -1 a 1,
            "reasoning": "explicação breve em português",
            "suggestedAction": "ação sugerida para o líder (se negativo/preocupante)"
          }

          Guia:
          - positive (0.3 a 1): progresso, entusiasmo, colaboração
          - neutral (-0.3 a 0.3): discussões técnicas neutras, atualizações de status
          - concerned (-0.6 a -0.3): dúvidas recorrentes, incerteza, pequenos conflitos
          - negative (-1 a -0.6): conflitos, desmotivação, prazos perdidos, abandono`,
        },
        {
          role: "user",
          content: `Últimas mensagens do canal do projeto:\n\n${messages.join("\n")}`,
        },
      ],
    });

    const result = JSON.parse(completion.choices[0].message.content ?? "{}") as SentimentResult;

    // Persist sentiment record
    const supabase = createAdminClient();
    await supabase.from("discord_sentiment_log").insert({
      org_id: orgId,
      project_id: projectId,
      channel_id: discordChannelId,
      sentiment: result.sentiment,
      score: result.score,
      reasoning: result.reasoning,
      suggested_action: result.suggestedAction,
      analyzed_at: new Date().toISOString(),
    }).catch(() => {}); // Non-critical

    // Check if alert threshold is met
    if (result.sentiment === "negative" || result.sentiment === "concerned") {
      const shouldAlert = await checkAlertThreshold(orgId, projectId, result.sentiment);
      if (shouldAlert) {
        await eventBus.emit<SentimentPayload>("DISCORD_SENTIMENT_ALERT", {
          orgId,
          projectId,
          discordChannelId,
          sentiment: result.sentiment,
          score: result.score,
          sampleMessages: messages.slice(-5),
          leaderId,
          leaderDiscordId,
        });
      }
    }

    return result;
  } catch (error) {
    console.error(`[SentimentService] Analysis failed:`, error);
    return null;
  }
}

/**
 * Verifica se é hora de disparar o alerta baseado no histórico recente.
 * Concerned por 2h seguidas → alerta
 * Negative por 30min → alerta imediato
 */
async function checkAlertThreshold(
  orgId: string,
  projectId: string,
  sentiment: SentimentScore
): Promise<boolean> {
  const supabase = createAdminClient();
  const thresholdMinutes = sentiment === "negative" ? 30 : 120;
  const since = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("discord_sentiment_log")
    .select("sentiment, analyzed_at")
    .eq("org_id", orgId)
    .eq("project_id", projectId)
    .gte("analyzed_at", since)
    .order("analyzed_at", { ascending: false });

  if (!data || data.length < 2) return false;

  // Check if ALL recent readings are at the same or worse level
  const badSentiments = new Set(["concerned", "negative"]);
  return data.every((r) => badSentiments.has(r.sentiment));
}

/**
 * Handler para DISCORD_SENTIMENT_ALERT:
 * Envia DM ao líder com análise + sugestão de reunião
 */
export async function handleSentimentAlert(payload: SentimentPayload): Promise<void> {
  if (!payload.leaderDiscordId) return;

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return;

  const sentimentEmoji = {
    positive: "😊",
    neutral: "😐",
    concerned: "😟",
    negative: "🚨",
  }[payload.sentiment];

  const message = `${sentimentEmoji} **Alerta de Sentimento do Time**

O canal do seu projeto está apresentando um padrão **${payload.sentiment === "negative" ? "negativo" : "preocupante"}** há algum tempo.

**Análise:** Parece que o time pode estar enfrentando dificuldades. Considere fazer um check-in.

**Sugestão:** Agende uma reunião rápida de alinhamento com o time para entender o que está acontecendo.

Acesse o Hïve para ver a análise completa e agendar a reunião: ${process.env.NEXT_PUBLIC_APP_URL}/projetos/${payload.projectId}`;

  try {
    // Create DM channel with leader
    const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: payload.leaderDiscordId }),
    });

    if (!dmRes.ok) return;
    const { id: dmChannelId } = await dmRes.json();

    // Send DM
    await fetch(`https://discord.com/api/v10/channels/${dmChannelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: message }),
    });

    console.info(`[SentimentService] Alert sent to leader ${payload.leaderDiscordId}`);
  } catch (error) {
    console.error(`[SentimentService] Failed to send DM alert:`, error);
  }
}
