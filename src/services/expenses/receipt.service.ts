/**
 * Expense Receipt Service
 *
 * Pipeline:
 *   1. GPT-4o Vision  — extrai valor, data, CNPJ do recibo
 *   2. Google Drive   — salva PDF/foto na pasta "Comprovantes"
 *   3. Google Sheets  — adiciona linha na planilha financeira
 *   4. Discord        — notifica financeiro com reação de aprovação
 *   5. Supabase       — salva registro na tabela expenses
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getDecryptedToken } from "@/lib/integrations/token-vault";
import OpenAI from "openai";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedReceiptData {
  amount: number;           // em centavos
  amountFormatted: string;  // "R$ 125,90"
  date: string;             // "DD/MM/YYYY"
  cnpj?: string;            // "XX.XXX.XXX/XXXX-XX"
  companyName?: string;     // razão social
  description?: string;     // descrição do gasto
  category?: string;        // "alimentação" | "transporte" | "material" | "serviço" | "outro"
  confidence: number;       // 0-1
}

export interface SubmitExpenseOptions {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  orgId: string;
  description?: string;     // override da descrição extraída
  category?: string;        // override da categoria
  projectId?: string;
}

export interface SubmitExpenseResult {
  expenseId: string;
  extracted: ExtractedReceiptData;
  driveFileId?: string;
  driveFileUrl?: string;
  sheetsRowNumber?: number;
  discordMessageId?: string;
  steps: Array<{ step: string; ok: boolean; error?: string }>;
}

interface StepResult { step: string; ok: boolean; data?: unknown; error?: string; }

async function runStep(name: string, fn: () => Promise<unknown>): Promise<StepResult> {
  try {
    const data = await fn();
    console.log(`[Expense] ✅ ${name}`);
    return { step: name, ok: true, data };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn(`[Expense] ⚠️ ${name}: ${error}`);
    return { step: name, ok: false, error };
  }
}

async function getOrgToken(orgId: string, provider: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("org_integrations")
    .select("access_token")
    .eq("org_id", orgId)
    .eq("provider", provider)
    .single();
  if (!data) return null;
  return getDecryptedToken(data.access_token);
}

// ─── Step 1: Extração com GPT-4o Vision ──────────────────────────────────────

export async function extractReceiptData(
  fileBuffer: Buffer,
  mimeType: string,
  descriptionHint?: string
): Promise<ExtractedReceiptData> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const base64 = fileBuffer.toString("base64");
  const imageUrl = `data:${mimeType};base64,${base64}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Você é um especialista em análise de recibos e notas fiscais brasileiras.
Analise a imagem e extraia as informações do recibo de forma precisa.
Retorne APENAS um JSON válido, sem markdown ou texto adicional.`,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageUrl, detail: "high" },
          },
          {
            type: "text",
            text: `Extraia as informações deste recibo/nota fiscal brasileiro.${descriptionHint ? ` Contexto adicional: ${descriptionHint}` : ""}

Retorne no formato JSON:
{
  "amount": número em centavos (ex: 12590 para R$125,90),
  "amountFormatted": "R$ 125,90",
  "date": "DD/MM/YYYY",
  "cnpj": "XX.XXX.XXX/XXXX-XX ou null",
  "companyName": "razão social ou nome do estabelecimento",
  "description": "breve descrição do que foi comprado/pago",
  "category": "alimentação|transporte|material|hospedagem|serviço|evento|outro",
  "confidence": 0.0 a 1.0 (confiança na extração)
}

Se algum campo não estiver visível, use null. Converta datas para DD/MM/YYYY.`,
          },
        ],
      },
    ],
    max_tokens: 500,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  return JSON.parse(content) as ExtractedReceiptData;
}

// ─── Step 2: Upload para Google Drive ────────────────────────────────────────

export async function uploadReceiptToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  orgId: string,
  memberName: string
): Promise<{ fileId: string; fileUrl: string } | null> {
  const token = await getOrgToken(orgId, "google_workspace");
  if (!token) return null;

  const admin = createAdminClient();

  // Busca ou cria pasta "Comprovantes"
  let folderId: string | undefined;
  const { data: org } = await admin
    .from("organizations")
    .select("finance_drive_folder_id")
    .eq("id", orgId)
    .single();

  if (org?.finance_drive_folder_id) {
    folderId = org.finance_drive_folder_id;
  } else {
    // Cria pasta "Comprovantes" no Drive raiz
    const folderRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Comprovantes — Hïve",
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
    if (folderRes.ok) {
      const folder = await folderRes.json() as { id: string };
      folderId = folder.id;
      // Salva ID da pasta na org
      await admin.from("organizations").update({ finance_drive_folder_id: folderId }).eq("id", orgId);
    }
  }

  // Upload do arquivo (multipart)
  const date = new Date().toISOString().split("T")[0];
  const uploadFileName = `${date}_${memberName.replace(/\s+/g, "_")}_${fileName}`;

  const metadata = {
    name: uploadFileName,
    parents: folderId ? [folderId] : [],
  };

  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(metadata);

  const filePart = delimiter +
    `Content-Type: ${mimeType}\r\n\r\n`;

  const bodyParts = [
    Buffer.from(metadataPart),
    Buffer.from(filePart),
    fileBuffer,
    Buffer.from(closeDelimiter),
  ];
  const body = Buffer.concat(bodyParts);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": body.length.toString(),
      },
      body,
    }
  );

  if (!uploadRes.ok) throw new Error(`Drive upload failed: ${uploadRes.status}`);
  const file = await uploadRes.json() as { id: string };

  return {
    fileId: file.id,
    fileUrl: `https://drive.google.com/file/d/${file.id}/view`,
  };
}

// ─── Step 3: Adicionar linha no Google Sheets ─────────────────────────────────

export async function addExpenseToSheets(
  extracted: ExtractedReceiptData,
  options: {
    orgId: string;
    memberName: string;
    driveFileUrl?: string;
    description?: string;
    projectId?: string;
  }
): Promise<{ sheetId: string; rowNumber: number } | null> {
  const token = await getOrgToken(options.orgId, "google_workspace");
  if (!token) return null;

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("finance_sheet_id, name")
    .eq("id", options.orgId)
    .single();

  let sheetId = org?.finance_sheet_id;

  // Cria planilha financeira se não existe
  if (!sheetId) {
    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: { title: `Financeiro — ${org?.name ?? "EJ"} (Hïve)` },
        sheets: [{
          properties: { title: "Reembolsos" },
          data: [{
            rowData: [{
              values: [
                "Data", "Membro", "Descrição", "Categoria",
                "CNPJ", "Empresa", "Valor (R$)", "Status",
                "Projeto", "Comprovante", "Data de Envio"
              ].map(v => ({ userEnteredValue: { stringValue: v } })),
            }],
          }],
        }],
      }),
    });

    if (createRes.ok) {
      const sheet = await createRes.json() as { spreadsheetId: string };
      sheetId = sheet.spreadsheetId;
      await admin.from("organizations").update({ finance_sheet_id: sheetId }).eq("id", options.orgId);
    }
  }

  if (!sheetId) return null;

  // Descobre próxima linha disponível
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Reembolsos!A:A`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const meta = await metaRes.json() as { values?: string[][] };
  const nextRow = (meta.values?.length ?? 1) + 1;

  // Adiciona linha de despesa
  const row = [
    extracted.date,
    options.memberName,
    options.description ?? extracted.description ?? "",
    extracted.category ?? "outro",
    extracted.cnpj ?? "",
    extracted.companyName ?? "",
    (extracted.amount / 100).toFixed(2).replace(".", ","),
    "Pendente",
    options.projectId ?? "",
    options.driveFileUrl ?? "",
    new Date().toLocaleDateString("pt-BR"),
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Reembolsos!A${nextRow}:K${nextRow}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    }
  );

  return { sheetId, rowNumber: nextRow };
}

// ─── Step 4: Notificar Discord com reação de aprovação ───────────────────────

export async function notifyExpenseToDiscord(options: {
  orgId: string;
  memberName: string;
  extracted: ExtractedReceiptData;
  driveFileUrl?: string;
  expenseId: string;
  description?: string;
}): Promise<string | null> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return null;

  const admin = createAdminClient();

  // Busca canal do financeiro
  const { data: channels } = await admin
    .from("discord_role_channels")
    .select("channel_id")
    .eq("organization_id", options.orgId)
    .eq("rank", "director")
    .limit(1);

  const channelId = channels?.[0]?.channel_id;
  if (!channelId) return null;

  const categoryEmojis: Record<string, string> = {
    alimentação: "🍽️", transporte: "🚗", material: "📦",
    hospedagem: "🏨", serviço: "🔧", evento: "🎉", outro: "📄",
  };
  const catEmoji = categoryEmojis[options.extracted.category ?? "outro"] ?? "📄";

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title: `${catEmoji} Solicitação de Reembolso`,
        description: `**${options.memberName}** solicitou reembolso.\nReaja com ✅ para aprovar ou ❌ para reprovar.`,
        color: 0xFEC045,
        fields: [
          { name: "💰 Valor", value: options.extracted.amountFormatted, inline: true },
          { name: "📅 Data", value: options.extracted.date, inline: true },
          { name: "🏷️ Categoria", value: options.extracted.category ?? "outro", inline: true },
          { name: "📝 Descrição", value: options.description ?? options.extracted.description ?? "Não informado" },
          ...(options.extracted.companyName ? [{ name: "🏢 Empresa", value: `${options.extracted.companyName}${options.extracted.cnpj ? ` (${options.extracted.cnpj})` : ""}` }] : []),
          ...(options.driveFileUrl ? [{ name: "🔗 Comprovante", value: `[Ver no Drive](${options.driveFileUrl})` }] : []),
        ],
        footer: { text: `ID: ${options.expenseId} • Hïve Financeiro` },
        timestamp: new Date().toISOString(),
      }],
    }),
  });

  if (!res.ok) return null;
  const message = await res.json() as { id: string };
  const messageId = message.id;

  // Adiciona reações de aprovação/reprovação
  await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/✅/@me`,
    { method: "PUT", headers: { Authorization: `Bot ${botToken}` } }
  );
  await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/❌/@me`,
    { method: "PUT", headers: { Authorization: `Bot ${botToken}` } }
  );

  return messageId;
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export async function submitExpense(options: SubmitExpenseOptions): Promise<SubmitExpenseResult> {
  const admin = createAdminClient();
  const results: StepResult[] = [];

  // ── 1. Extração com GPT-4o Vision ─────────────────────────
  let extracted!: ExtractedReceiptData;
  const extractStep = await runStep("gpt4o_vision_extract", async () => {
    extracted = await extractReceiptData(options.fileBuffer, options.mimeType, options.description);
    return extracted;
  });
  results.push(extractStep);
  if (!extractStep.ok) throw new Error("Receipt extraction failed: " + extractStep.error);

  // Aplica overrides do usuário
  if (options.description) extracted.description = options.description;
  if (options.category) extracted.category = options.category;

  // ── 2. Cria registro no banco (antes do drive para ter ID) ──
  const { data: expense, error: insertError } = await admin
    .from("expenses")
    .insert({
      organization_id: options.orgId,
      member_id: options.memberId,
      project_id: options.projectId ?? null,
      amount: extracted.amount,
      currency: "BRL",
      date: extracted.date,
      cnpj: extracted.cnpj ?? null,
      company_name: extracted.companyName ?? null,
      description: extracted.description ?? null,
      category: extracted.category ?? "outro",
      status: "pending",
      ai_extraction: extracted,
    })
    .select()
    .single();

  if (insertError || !expense) throw new Error(insertError?.message ?? "Insert failed");

  // ── 3. Upload para Drive ──────────────────────────────────
  let driveFileId: string | undefined;
  let driveFileUrl: string | undefined;
  const driveStep = await runStep("google_drive_upload", async () => {
    const result = await uploadReceiptToDrive(
      options.fileBuffer, options.fileName, options.mimeType,
      options.orgId, options.memberName
    );
    driveFileId = result?.fileId;
    driveFileUrl = result?.fileUrl;
    return result ?? { skipped: "no google_workspace" };
  });
  results.push(driveStep);

  // ── 4. Google Sheets ──────────────────────────────────────
  let sheetsRowNumber: number | undefined;
  const sheetsStep = await runStep("google_sheets_add_row", async () => {
    const result = await addExpenseToSheets(extracted, {
      orgId: options.orgId,
      memberName: options.memberName,
      driveFileUrl,
      description: options.description,
      projectId: options.projectId,
    });
    sheetsRowNumber = result?.rowNumber;
    return result ?? { skipped: "no google_workspace" };
  });
  results.push(sheetsStep);

  // ── 5. Discord notification ───────────────────────────────
  let discordMessageId: string | undefined;
  const discordStep = await runStep("discord_expense_notification", async () => {
    const msgId = await notifyExpenseToDiscord({
      orgId: options.orgId,
      memberName: options.memberName,
      extracted,
      driveFileUrl,
      expenseId: expense.id,
      description: options.description,
    });
    discordMessageId = msgId ?? undefined;
    return { messageId: msgId };
  });
  results.push(discordStep);

  // ── 6. Atualiza registro com IDs de drive/sheets/discord ──
  await admin.from("expenses").update({
    receipt_url: driveFileUrl ?? null,
    drive_file_id: driveFileId ?? null,
    sheets_row: sheetsRowNumber ?? null,
    discord_message_id: discordMessageId ?? null,
  }).eq("id", expense.id);

  // ── 7. Audit log ──────────────────────────────────────────
  await admin.from("audit_logs").insert({
    organization_id: options.orgId,
    user_id: options.memberId,
    action: "EXPENSE_SUBMITTED",
    entity_type: "expense",
    entity_id: expense.id,
    metadata: {
      amount: extracted.amountFormatted,
      category: extracted.category,
      memberName: options.memberName,
    },
  });

  console.log(`[Expense] Submetido — ${results.filter(r => r.ok).length}/${results.length} etapas ✅`);

  return {
    expenseId: expense.id,
    extracted,
    driveFileId,
    driveFileUrl,
    sheetsRowNumber,
    discordMessageId,
    steps: results.map(r => ({ step: r.step, ok: r.ok, error: r.error })),
  };
}

// ─── Aprovação / Reprovação ───────────────────────────────────────────────────

export async function approveExpense(
  expenseId: string,
  approverId: string,
  orgId: string,
  approved: boolean,
  reason?: string
): Promise<void> {
  const admin = createAdminClient();

  const newStatus = approved ? "approved" : "rejected";

  // Atualiza status no banco
  await admin.from("expenses").update({
    status: newStatus,
    reviewed_by: approverId,
    reviewed_at: new Date().toISOString(),
    rejection_reason: approved ? null : reason,
  }).eq("id", expenseId).eq("organization_id", orgId);

  // Busca dados da despesa para notificar membro
  const { data: expense } = await admin
    .from("expenses")
    .select("member_id, amount, description, discord_message_id, sheets_row, organization_id")
    .eq("id", expenseId)
    .single();

  if (!expense) return;

  // Atualiza coluna de status no Sheets
  const sheetsToken = await getOrgToken(orgId, "google_workspace");
  if (sheetsToken && expense.sheets_row) {
    const { data: org } = await admin
      .from("organizations")
      .select("finance_sheet_id")
      .eq("id", orgId)
      .single();

    if (org?.finance_sheet_id) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${org.finance_sheet_id}/values/Reembolsos!H${expense.sheets_row}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${sheetsToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: [[approved ? "Aprovado ✅" : "Reprovado ❌"]] }),
        }
      );
    }
  }

  // Busca dados do membro para notificação
  const { data: member } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", expense.member_id)
    .single();

  // Envia email de notificação ao membro
  if (member && sheetsToken) {
    const amountFormatted = `R$ ${(expense.amount / 100).toFixed(2).replace(".", ",")}`;
    const html = `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:${approved ? "linear-gradient(135deg,#166534,#16a34a)" : "linear-gradient(135deg,#991b1b,#dc2626)"};padding:24px 32px;border-radius:16px 16px 0 0">
        <h1 style="color:#fff;font-size:18px;margin:0">${approved ? "✅ Reembolso Aprovado" : "❌ Reembolso Reprovado"}</h1>
      </div>
      <div style="background:#fff;padding:28px 32px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 16px 16px">
        <p style="color:#475569">Olá ${member.full_name?.split(" ")[0]},</p>
        <p style="color:#475569">Sua solicitação de reembolso de <strong>${amountFormatted}</strong>${expense.description ? ` (${expense.description})` : ""} foi <strong>${approved ? "aprovada" : "reprovada"}</strong>.</p>
        ${!approved && reason ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin:16px 0"><p style="color:#dc2626;margin:0;font-size:14px">Motivo: ${reason}</p></div>` : ""}
        ${approved ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin:16px 0"><p style="color:#166534;margin:0;font-size:14px">O valor será processado conforme o procedimento financeiro da sua EJ.</p></div>` : ""}
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">Hïve — Sistema de Reembolsos</p>
      </div>
    </div>`;

    const message = [
      `To: ${member.email}`,
      `Subject: ${approved ? "✅" : "❌"} Reembolso ${approved ? "Aprovado" : "Reprovado"} — ${amountFormatted}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      html,
    ].join("\r\n");

    await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${sheetsToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(message).toString("base64url") }),
    }).catch(() => {}); // falha silenciosa
  }

  // Audit log
  await admin.from("audit_logs").insert({
    organization_id: orgId,
    user_id: approverId,
    action: approved ? "EXPENSE_APPROVED" : "EXPENSE_REJECTED",
    entity_type: "expense",
    entity_id: expenseId,
    metadata: { amount: expense.amount, reason },
  });
}
