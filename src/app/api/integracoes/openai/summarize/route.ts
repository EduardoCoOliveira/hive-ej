import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY não configurada" }, { status: 503 });
  }

  const openai = new OpenAI({ apiKey });
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rawText, projectId, meetingTitle, saveToNotion = false } = await req.json();

  if (!rawText || rawText.length < 50) {
    return NextResponse.json({ error: "rawText muito curto" }, { status: 400 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("name, client_name")
    .eq("id", projectId)
    .single();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content:
          "Estruture a ata em português:\n📋 PARTICIPANTES\n✅ DECISÕES\n📌 PRÓXIMOS PASSOS\n⚠️ ATENÇÃO",
      },
      {
        role: "user",
        content: `Projeto: ${project?.name} — ${project?.client_name}\nReunião: ${meetingTitle}\n\n${rawText}`,
      },
    ],
  });

  return NextResponse.json({
    summary: completion.choices[0].message.content ?? "",
    savedToNotion: saveToNotion ? false : false,
  });
}
