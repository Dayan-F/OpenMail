import { NextRequest, NextResponse } from "next/server";
import { makeModel, type LLMConfig } from "@/lib/llm";
import { HumanMessage } from "@langchain/core/messages";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cfg = body as LLMConfig;

  if (cfg.provider === "groq" && !cfg.apiKey) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }
  if (cfg.provider === "ollama" && !cfg.baseUrl) {
    return NextResponse.json({ error: "Base URL is required" }, { status: 400 });
  }

  try {
    const model = makeModel(cfg);
    await model.invoke([new HumanMessage("Reply with the single word: ok")]);

    // Persist the validated config so /inbox → Run now can use it.
    const session = await getSession();
    session.llmConfig = cfg;
    session.demoMode = false;
    await session.save();

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
