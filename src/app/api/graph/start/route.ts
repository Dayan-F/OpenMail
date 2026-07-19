import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { graph } from "@/graph/index";
import { getSession } from "@/lib/session";
import { getSetting, setSetting, initDb } from "@/lib/db";
import type { FetchWindow } from "@/lib/types";
import type { GraphConfig } from "@/graph/state";
import type { LLMConfig } from "@/lib/llm";

const CURSOR_KEY = "lastProcessedAt";

export async function POST(req: NextRequest) {
  const session = await getSession();

  let body: { demoMode?: boolean; fetchWindow?: FetchWindow };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const demoMode = body.demoMode ?? false;
  const fetchWindow: FetchWindow = body.fetchWindow ?? { mode: "incremental" };

  // Demo prefers the AI you connected in the UI; falls back to an env key so a
  // hosted demo can run with no login.
  const demoEnvKey = process.env.DEMO_GROQ_API_KEY || process.env.GROQ_API_KEY || "";
  const demoFallback: LLMConfig | undefined = demoEnvKey
    ? { provider: "groq", apiKey: demoEnvKey, model: "llama-3.3-70b-versatile" }
    : undefined;
  const llmConfig: LLMConfig | undefined = demoMode
    ? session.llmConfig ?? demoFallback
    : session.llmConfig;

  if (!llmConfig || (llmConfig.provider === "groq" && !llmConfig.apiKey)) {
    return NextResponse.json(
      { error: "Connect an AI provider first.", needsSetup: true },
      { status: 401 }
    );
  }
  if (!demoMode && !session.googleTokens) {
    return NextResponse.json(
      { error: "Not connected to Gmail. Connect your Google account first.", needsAuth: true },
      { status: 401 }
    );
  }

  // Incremental cursor lives in the DB, not the cookie (cookies can't be set
  // once the SSE body starts streaming). Backfill runs ignore and never advance it.
  await initDb();
  const storedCursor = demoMode ? null : await getSetting(CURSOR_KEY);
  const runStartedAt = new Date().toISOString();

  const threadId = crypto.randomUUID();
  session.threadId = threadId;
  session.demoMode = demoMode;
  session.fetchMode = fetchWindow.mode;
  session.llmConfig = llmConfig;   // resolved config (demo key or user key) — reused on resume
  await session.save();

  const configurable: GraphConfig & { thread_id: string } = {
    thread_id: threadId,
    demoMode,
    llmConfig,
    fetchWindow,
    googleTokens: session.googleTokens,
  };

  const initialState = {
    emails: [],
    classifications: {},
    drafts: {},
    replyContext: {},
    cursor: 0,
    lastAction: null as null,
    decisions: [],
    userVoice: "",
    lastProcessedAt: storedCursor,
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        const graphStream = await graph.stream(initialState, {
          configurable,
          streamMode: "values",
        });

        for await (const chunk of graphStream) {
          if ("__interrupt__" in chunk) {
            const payload = (chunk.__interrupt__ as { value: object }[])[0].value;
            send({ type: "interrupt", ...payload });
            return;
          }

          // Only send meaningful state updates (after classify and after each decision)
          const state = chunk as typeof initialState & { classifications: object; decisions: object[] };
          if (Object.keys(state.classifications ?? {}).length > 0) {
            send({
              type: "state",
              emails: state.emails,
              classifications: state.classifications,
              decisions: state.decisions,
              cursor: state.cursor,
            });
          }
        }

        // The "values" stream doesn't reliably surface __interrupt__, so after the
        // stream ends we check graph state for a pending interrupt (the paused draft).
        const snapshot = await graph.getState({ configurable });
        const pending = (snapshot.tasks ?? []).flatMap(
          (t) => (t.interrupts ?? []) as { value: object }[]
        );
        if (pending.length > 0) {
          send({ type: "interrupt", ...pending[0].value });
          return;
        }

        // Advance the incremental cursor only on a fully completed, real, incremental run.
        if (!demoMode && fetchWindow.mode === "incremental") {
          await setSetting(CURSOR_KEY, runStartedAt);
        }
        send({ type: "done" });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Graph error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
