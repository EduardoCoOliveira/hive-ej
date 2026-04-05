// ─────────────────────────────────────────────────────────────
//  OpenAI Client — sumarização e rascunhos com GPT-4o
// ─────────────────────────────────────────────────────────────

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Sumariza a ata de uma reunião em formato estruturado */
export async function summarizeMeeting(rawText: string, projectName: string): Promise<string> {
  const chat = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `Você é um assistente de Empresa Júnior brasileiro. Sumarize atas de reuniões de forma clara, objetiva e estruturada em português.
Formato de saída:
**Participantes:** ...
**Principais decisões:** ...
**Próximos passos:** ...
**Responsáveis e prazos:** ...`,
      },
      {
        role: "user",
        content: `Projeto: ${projectName}\n\nAta da reunião:\n\n${rawText}`,
      },
    ],
    max_tokens: 800,
  });

  return chat.choices[0]?.message?.content ?? "";
}

/** Gera rascunho de proposta comercial para um projeto */
export async function draftProposal(opts: {
  clientName: string;
  projectDescription: string;
  orgName: string;
  estimatedValue: number;
}): Promise<string> {
  const chat = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content: `Você é um consultor sênior de uma Empresa Júnior brasileira chamada ${opts.orgName}.
Escreva propostas comerciais profissionais, persuasivas e bem estruturadas em português, adequadas para o mercado de EJs.`,
      },
      {
        role: "user",
        content: `Crie uma proposta comercial para:
Cliente: ${opts.clientName}
Projeto: ${opts.projectDescription}
Valor estimado: R$ ${opts.estimatedValue.toLocaleString("pt-BR")}

Inclua: apresentação da EJ, diagnóstico do problema, solução proposta, metodologia, entregáveis, investimento e próximos passos.`,
      },
    ],
    max_tokens: 2000,
  });

  return chat.choices[0]?.message?.content ?? "";
}

/** Sugere alocação de consultores com base em contexto */
export async function suggestAllocation(opts: {
  projectDescription: string;
  requiredSkills: string[];
  availableMembers: { name: string; skills: string[]; hoursPerWeek: number }[];
}): Promise<string> {
  const membersText = opts.availableMembers
    .map((m) => `- ${m.name}: ${m.skills.join(", ")} (${m.hoursPerWeek}h/sem disponíveis)`)
    .join("\n");

  const chat = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: "Você é um gerente de projetos de Empresa Júnior. Sugira a melhor alocação de consultores para projetos com base em competências e disponibilidade.",
      },
      {
        role: "user",
        content: `Projeto: ${opts.projectDescription}
Competências necessárias: ${opts.requiredSkills.join(", ")}

Membros disponíveis:
${membersText}

Sugira quem alocar e em qual papel, justificando brevemente.`,
      },
    ],
    max_tokens: 600,
  });

  return chat.choices[0]?.message?.content ?? "";
}
