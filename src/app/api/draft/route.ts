import { NextRequest, NextResponse } from "next/server";
import { draftReply } from "@/lib/draftReply";
import { getSession } from "@/lib/session";

// On-demand draft for a single email (e.g. re-drafting one you skipped),
// independent of the graph run.
export async function POST(req: NextRequest) {
  const session = await getSession();

  const demoKey = process.env.DEMO_GROQ_API_KEY || process.env.GROQ_API_KEY || "";
  const llmConfig =
    session.llmConfig ??
    (demoKey ? ({ provider: "groq", apiKey: demoKey, model: "llama-3.3-70b-versatile" } as const) : undefined);

  if (!llmConfig || (llmConfig.provider === "groq" && !llmConfig.apiKey)) {
    return NextResponse.json({ error: "Connect an AI provider first.", needsSetup: true }, { status: 401 });
  }

  let email: { from: string; subject: string; body: string };
  try {
    email = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!email?.from || !email?.subject) {
    return NextResponse.json({ error: "email from/subject required" }, { status: 400 });
  }

  try {
    const draft = await draftReply(llmConfig, { from: email.from, subject: email.subject, body: email.body ?? "" });
    return NextResponse.json({ draft });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Draft failed" },
      { status: 502 }
    );
  }
}
