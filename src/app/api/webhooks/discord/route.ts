/**
 * POST /api/webhooks/discord
 *
 * Recebe interações do Discord Bot (slash commands + reaction events).
 *
 * Comandos suportados:
 *   /reembolso valor:<número> descricao:<texto> categoria:<tipo>
 *     → Inicia fluxo de reembolso por URL de imagem (attachment)
 *     → O bot pede upload de comprovante, então processa
 *
 *   /ata projeto:<nome>
 *     → Inicia upload de áudio via Discord para gerar ata
 *
 * Reaction events:
 *   ✅ em mensagem de reembolso → aprova
 *   ❌ em mensagem de reembolso → reprova (bot pede motivo)
 *
 * Segurança: verifica assinatura Ed25519 do Discord
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveExpense } from "@/services/expenses/receipt.service";
import nacl from "tweetnacl";

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY ?? "";

// ─── Verificação de assinatura ────────────────────────────────────────────────

async function verifyDiscordRequest(req: NextRequest, body: string): Promise<boolean> {
  if (!DISCORD_PUBLIC_KEY) return true; // dev mode

  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  if (!signature || !timestamp) return false;

  try {
    const isValid = nacl.sign.detached.verify(
      Buffer.from(timestamp + body),
      Buffer.from(signature, "hex"),
      Buffer.from(DISCORD_PUBLIC_KEY, "hex")
    );
    return isValid;
  } catch {
    return false;
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verifica autenticidade da requisição
  const isValid = await verifyDiscordRequest(req, rawBody);
  if (!isValid) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody) as DiscordInteraction;

  // Tipo 1: PING — Discord verifica o endpoint
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // Tipo 2: APPLICATION_COMMAND (slash commands)
  if (interaction.type === 2) {
    return handleSlashCommand(interaction);
  }

  // Tipo 3: MESSAGE_COMPONENT (botões, selects)
  if (interaction.type === 3) {
    return handleComponent(interaction);
  }

  return NextResponse.json({ type: 1 });
}

// ─── Slash Commands ───────────────────────────────────────────────────────────

async function handleSlashCommand(interaction: DiscordInteraction): Promise<NextResponse> {
  const commandName = interaction.data?.name;
  const guildId = interaction.guild_id;

  if (!guildId) {
    return respondEphemeral("❌ Este comando só pode ser usado em servidores.");
  }

  const admin = createAdminClient();

  // Busca org pelo guild_id do Discord
  const { data: org } = await admin
    .from("organizations")
    .select("id, name")
    .eq("discord_guild_id", guildId)
    .single();

  if (!org) {
    return respondEphemeral("❌ Este servidor não está vinculado a nenhuma organização no Hïve.");
  }

  // Busca membro pelo Discord ID
  const discordUserId = interaction.member?.user?.id;
  const { data: member } = await admin
    .from("profiles")
    .select("id, full_name, email, rank")
    .eq("discord_id", discordUserId)
    .eq("organization_id", org.id)
    .single();

  if (!member) {
    return respondEphemeral("❌ Seu Discord não está vinculado a nenhum membro da organização. Configure no Hïve.");
  }

  // ── /reembolso ────────────────────────────────────────────
  if (commandName === "reembolso") {
    const options = parseOptions(interaction.data?.options ?? []);
    const imageUrl = options.comprovante as string | undefined;

    if (!imageUrl) {
      return respondEphemeral(
        "📎 Envie o comprovante!\n\nUse: `/reembolso comprovante:<url_da_imagem> descricao:<texto>`\n\nOu acesse o Hïve para upload direto."
      );
    }

    // Faz download da imagem do Discord
    try {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error("Download failed");

      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const mimeType = imgRes.headers.get("content-type") ?? "image/jpeg";
      const fileName = imageUrl.split("/").pop()?.split("?")[0] ?? "comprovante.jpg";

      // Importa o serviço de forma lazy para evitar circular deps
      const { submitExpense } = await import("@/services/expenses/receipt.service");

      const result = await submitExpense({
        fileBuffer: buffer,
        fileName,
        mimeType,
        memberId: member.id,
        memberName: member.full_name ?? "Membro",
        memberEmail: member.email ?? "",
        orgId: org.id,
        description: options.descricao as string | undefined,
        category: options.categoria as string | undefined,
      });

      return NextResponse.json({
        type: 4,
        data: {
          flags: 64, // ephemeral
          embeds: [{
            title: "✅ Reembolso submetido!",
            description: `Valor extraído: **${result.extracted.amountFormatted}**\nO financeiro foi notificado e irá revisar em breve.`,
            color: 0x22c55e,
            fields: [
              { name: "Categoria", value: result.extracted.category ?? "outro", inline: true },
              { name: "Data", value: result.extracted.date, inline: true },
              ...(result.driveFileUrl ? [{ name: "Comprovante", value: `[Drive](${result.driveFileUrl})`, inline: true }] : []),
            ],
          }],
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return respondEphemeral(`❌ Erro ao processar comprovante: ${msg}`);
    }
  }

  // ── /ata ──────────────────────────────────────────────────
  if (commandName === "ata") {
    const options = parseOptions(interaction.data?.options ?? []);
    const audioUrl = options.audio as string | undefined;

    if (!audioUrl) {
      return respondEphemeral(
        "🎙️ Para gerar a ata, use:\n`/ata audio:<url_do_audio> titulo:<titulo>`\n\nOu acesse o Hïve para upload direto."
      );
    }

    // Processa em background (não bloqueia resposta do Discord)
    processAudioInBackground(audioUrl, {
      orgId: org.id,
      uploadedBy: member.id,
      title: options.titulo as string | undefined,
      channelId: interaction.channel_id,
    }).catch(console.error);

    return NextResponse.json({
      type: 4,
      data: {
        flags: 0,
        embeds: [{
          title: "🎙️ Processando áudio...",
          description: "A ata será gerada em alguns minutos. Você receberá uma notificação aqui quando estiver pronta.",
          color: 0x4E378C,
          footer: { text: "Hïve — Transcrição Automática" },
        }],
      },
    });
  }

  return respondEphemeral("Comando não reconhecido.");
}

// ─── Componentes (botões) ─────────────────────────────────────────────────────

async function handleComponent(interaction: DiscordInteraction): Promise<NextResponse> {
  const customId = interaction.data?.custom_id ?? "";

  // Formato: "expense_approve:EXPENSE_ID" ou "expense_reject:EXPENSE_ID"
  if (customId.startsWith("expense_approve:") || customId.startsWith("expense_reject:")) {
    const [action, expenseId] = customId.split(":");
    const approved = action === "expense_approve";

    const admin = createAdminClient();
    const guildId = interaction.guild_id;

    const { data: org } = await admin
      .from("organizations")
      .select("id")
      .eq("discord_guild_id", guildId ?? "")
      .single();

    if (!org) return respondEphemeral("Org não encontrada.");

    const discordUserId = interaction.member?.user?.id;
    const { data: approver } = await admin
      .from("profiles")
      .select("id, rank")
      .eq("discord_id", discordUserId)
      .eq("organization_id", org.id)
      .single();

    if (!approver || !["director", "president"].includes(approver.rank)) {
      return respondEphemeral("❌ Apenas Diretores podem aprovar reembolsos.");
    }

    await approveExpense(expenseId, approver.id, org.id, approved);

    return NextResponse.json({
      type: 4,
      data: {
        flags: 64,
        content: approved
          ? `✅ Reembolso aprovado por <@${discordUserId}>`
          : `❌ Reembolso reprovado por <@${discordUserId}>`,
      },
    });
  }

  return respondEphemeral("Ação não reconhecida.");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function respondEphemeral(content: string): NextResponse {
  return NextResponse.json({ type: 4, data: { flags: 64, content } });
}

function parseOptions(options: Array<{ name: string; value: unknown }>): Record<string, unknown> {
  return Object.fromEntries(options.map(o => [o.name, o.value]));
}

async function processAudioInBackground(
  audioUrl: string,
  options: { orgId: string; uploadedBy: string; title?: string; channelId?: string }
): Promise<void> {
  try {
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error("Audio download failed");

    const buffer = Buffer.from(await audioRes.arrayBuffer());
    const fileName = audioUrl.split("/").pop()?.split("?")[0] ?? "audio.mp3";

    const { processMeetingAudio } = await import("@/services/meetings/transcription.service");

    await processMeetingAudio({
      audioBuffer: buffer,
      audioFileName: fileName,
      orgId: options.orgId,
      uploadedBy: options.uploadedBy,
      title: options.title,
    });
  } catch (err) {
    console.error("[Discord/ata background]", err);

    // Notifica erro no canal se possível
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (botToken && options.channelId) {
      await fetch(`https://discord.com/api/v10/channels/${options.channelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `❌ Erro ao processar áudio: ${err instanceof Error ? err.message : String(err)}`,
        }),
      }).catch(() => {});
    }
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscordInteraction {
  type: number;
  guild_id?: string;
  channel_id?: string;
  member?: { user?: { id: string; username: string } };
  data?: {
    name?: string;
    custom_id?: string;
    options?: Array<{ name: string; value: unknown }>;
  };
}
