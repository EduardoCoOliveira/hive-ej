import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(new URL("/api/smart-match", req.url), {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") ?? "" },
    body: JSON.stringify({ requiredSkills: body.requiredSkills ?? [], hoursPerWeek: body.hoursPerWeek ?? 10 }),
  });
  return NextResponse.json(await res.json());
}
