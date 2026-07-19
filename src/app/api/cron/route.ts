import { NextRequest, NextResponse } from "next/server";
import { graph } from "@/graph/index";
import { getSession } from "@/lib/session";
import { initDb, getSetting, setSetting } from "@/lib/db";
import crypto from "crypto";
import type { GraphConfig } from "@/graph/state";

const CURSOR_KEY = "lastProcessedAt";

// Called by Railway/Render cron or an external scheduler.
// Protect with a shared secret so only the scheduler can trigger it.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getSession();
  if (!session.googleTokens || !session.llmConfig) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 });
  }

  await initDb();
  const storedCursor = await getSetting(CURSOR_KEY);
  const runStartedAt = new Date().toISOString();

  const threadId = crypto.randomUUID();
  const configurable: GraphConfig & { thread_id: string } = {
    thread_id: threadId,
    demoMode: false,
    llmConfig: session.llmConfig,
    fetchWindow: { mode: "incremental" },
    googleTokens: session.googleTokens,
  };

  const initialState = {
    emails: [], classifications: {}, drafts: {}, replyContext: {},
    cursor: 0, lastAction: null as null, decisions: [], userVoice: "",
    lastProcessedAt: storedCursor,
  };

  // Run without interrupts for cron — reply emails are drafted but not sent
  // (reviewGate still fires; without a human to resume, they stay pending in the checkpointer)
  await graph.invoke(initialState, { configurable });
  await setSetting(CURSOR_KEY, runStartedAt);

  return NextResponse.json({ ok: true, threadId });
}
