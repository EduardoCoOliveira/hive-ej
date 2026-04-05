/**
 * Hïve — OpenAI Playbook Service
 *
 * Gera guias de liderança personalizados com GPT-4o.
 * O líder recebe orientação específica para cada etapa do projeto,
 * adaptada ao contexto real do cliente e da equipe.
 */

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type PlaybookStep =
  | "pre_kickoff"       // O que preparar antes da primeira reunião
  | "kickoff"           // Como conduzir o kickoff
  | "scope_presentation"// Como apresentar o escopo ao cliente
  | "weekly_meeting"    // Template de reunião semanal
  | "final_delivery"    // Checklist de entrega final
  | "post_project";     // Follow-up e feedback pós-projeto

export interface ProjectContext {
  projectName: string;
  clientName: string;
  clientContext: string;       // Descrição livre do cliente
  clientIndustry?: string;
  clientSize?: string;
  value: number;
  startDate?: string;
  endDate?: string;
  teamSize: number;
  teamSkills: string[];        // Competências do time
  leaderName: string;
  completedProjects: number;   // Experiência do líder
  currentStatus?: string;
}

export interface PlaybookGuide {
  step: PlaybookStep;
  title: string;
  objective: string;
  preparation: string[];       // O que fazer antes
  script: string;              // Script/roteiro para a situação
  keyQuestions: string[];      // Perguntas-chave para o cliente/time
  watchOutFor: string[];       // O que evitar / red flags
  nextActions: string[];       // O que fazer depois
  estimatedDuration: string;   // "30-45 minutos"
  tips: string[];              // Dicas personalizadas
}

/**
 * Gera o Playbook completo de um líder para um projeto específico.
 * GPT-4o usa o contexto completo para personalizar cada etapa.
 */
export async function generateLeaderPlaybook(
  context: ProjectContext,
  step: PlaybookStep
): Promise<PlaybookGuide | null> {
  const stepDescriptions: Record<PlaybookStep, string> = {
    pre_kickoff: "Preparação para a primeira reunião com o cliente",
    kickoff: "Condução da reunião de kickoff do projeto",
    scope_presentation: "Apresentação e validação do escopo com o cliente",
    weekly_meeting: "Reunião semanal de acompanhamento do projeto",
    final_delivery: "Entrega final do projeto e coleta de feedback",
    post_project: "Follow-up pós-entrega e nutrição do relacionamento com o cliente",
  };

  const prompt = `Você é um mentor sênior de Empresas Juniores (EJs) brasileiras, com 10 anos de experiência orientando líderes de projetos.

Gere um guia PRÁTICO e PERSONALIZADO para o líder conduzir a seguinte etapa do projeto:

**ETAPA:** ${stepDescriptions[step]}

**CONTEXTO DO PROJETO:**
- Nome: ${context.projectName}
- Cliente: ${context.clientName}
- Sobre o cliente: ${context.clientContext}
- Setor: ${context.clientIndustry ?? "Não informado"}
- Porte: ${context.clientSize ?? "Não informado"}
- Valor: R$ ${context.value.toLocaleString("pt-BR")}
- Período: ${context.startDate ?? "A definir"} a ${context.endDate ?? "A definir"}

**SOBRE A EQUIPE:**
- Líder: ${context.leaderName} (${context.completedProjects} projetos anteriores)
- Tamanho: ${context.teamSize} pessoas
- Competências: ${context.teamSkills.join(", ")}

Retorne um JSON estruturado com os campos:
{
  "step": "${step}",
  "title": "título do guia",
  "objective": "objetivo desta etapa em 1 frase",
  "preparation": ["lista de preparativos antes da reunião/ação"],
  "script": "roteiro detalhado de como conduzir a situação, incluindo frases sugeridas",
  "keyQuestions": ["perguntas estratégicas para fazer ao cliente ou time"],
  "watchOutFor": ["sinais de alerta e erros comuns a evitar"],
  "nextActions": ["o que fazer imediatamente após esta etapa"],
  "estimatedDuration": "X-Y minutos",
  "tips": ["dicas específicas para este contexto de cliente/projeto"]
}

Seja específico, prático e adaptado à realidade de uma EJ brasileira. Use linguagem direta.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "user", content: prompt },
      ],
    });

    const guide = JSON.parse(completion.choices[0].message.content ?? "{}") as PlaybookGuide;
    return guide;
  } catch (error) {
    console.error(`[PlaybookService] Failed to generate guide for step "${step}":`, error);
    return null;
  }
}

/**
 * Gera o Arquivo de Retomada quando um projeto é pausado.
 * Consolida tudo que foi feito para que o time possa retomar sem perder o fio.
 */
export async function generateIntelligenceBackup(opts: {
  projectName: string;
  clientName: string;
  clientContext: string;
  completedTasks: string[];      // De ClickUp
  decisions: string[];           // De atas no Notion
  deliverableLinks: { name: string; url: string; status: string }[];
  teamMembers: string[];
  pauseReason?: string;
}): Promise<string | null> {
  const prompt = `Você é um especialista em gestão do conhecimento em Empresas Juniores.

Um projeto foi PAUSADO e você precisa criar um "Arquivo de Retomada" completo e estruturado,
para que o time possa retomar o trabalho daqui a semanas ou meses sem perder contexto.

**PROJETO:** ${opts.projectName}
**CLIENTE:** ${opts.clientName}
**CONTEXTO:** ${opts.clientContext}
**MOTIVO DA PAUSA:** ${opts.pauseReason ?? "Não especificado"}

**O QUE FOI FEITO (ClickUp):**
${opts.completedTasks.map((t) => `- ${t}`).join("\n")}

**DECISÕES TOMADAS (Atas):**
${opts.decisions.map((d) => `- ${d}`).join("\n")}

**ENTREGÁVEIS:**
${opts.deliverableLinks.map((d) => `- ${d.name}: ${d.status} (${d.url})`).join("\n")}

**TIME:**
${opts.teamMembers.join(", ")}

Crie um documento de retomada em Markdown, estruturado, claro e acionável.
Inclua: resumo executivo, contexto do cliente, o que foi feito, estado atual,
próximos passos prioritários, e "por onde começar" com 3 ações imediatas.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    });

    return completion.choices[0].message.content ?? null;
  } catch (error) {
    console.error(`[PlaybookService] Failed to generate intelligence backup:`, error);
    return null;
  }
}

/**
 * Gera prompts automáticos úteis baseados no contexto JSON do projeto.
 * O líder recebe sugestões de perguntas e ações relevantes.
 */
export async function generateContextualPrompts(
  context: ProjectContext
): Promise<string[]> {
  const prompt = `Com base no contexto abaixo de um projeto de Empresa Júnior, gere 5 perguntas
ou sugestões de ação ESPECÍFICAS e ÚTEIS que o líder pode explorar agora.

Projeto: ${context.projectName}
Cliente: ${context.clientName} (${context.clientContext})
Valor: R$ ${context.value.toLocaleString("pt-BR")}
Status: ${context.currentStatus ?? "Em andamento"}
Time: ${context.teamSize} pessoas com competências em ${context.teamSkills.join(", ")}

Retorne um JSON: { "prompts": ["sugestão 1", "sugestão 2", ...] }

Exemplos do nível de especificidade desejado:
- "Considerando que o cliente é do setor X, quais métricas de sucesso devo propor?"
- "O time tem habilidade em Y mas o escopo exige Z. Como posso compensar essa lacuna?"`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const { prompts } = JSON.parse(completion.choices[0].message.content ?? '{"prompts":[]}');
    return prompts as string[];
  } catch {
    return [];
  }
}
