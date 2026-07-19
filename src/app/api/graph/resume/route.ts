import { NextRequest, NextResponse } from "next/server";
import { Command } from "@langchain/langgraph";
import { graph } from "@/graph/index";
import { getSession } from "@/lib/session";
import { setSetting } from "@/lib/db";
import type { GraphConfig } from "@/graph/state";

type Decision =
  | { action: "approve" }
  | { action: "edit"; editedBody: string }
  | { action: "skip" };

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session.threadId) {
    return NextResponse.json({ error: "No active run" }, { status: 400 });
  }
  if (!session.llmConfig) {
    return NextResponse.json({ error: "LLM not configured" }, { status: 401 });
  }

  let decision: Decision;
  try {
    decision = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const demoMode = session.demoMode ?? false;
  const fetchMode = session.fetchMode ?? "incremental";

  const configurable: GraphConfig & { thread_id: string } = {
    thread_id: session.threadId,
    demoMode,
    llmConfig: session.llmConfig,
    fetchWindow: { mode: "incremental" },
    googleTokens: session.googleTokens,
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        const graphStream = await graph.stream(
          new Command({ resume: decision }),
          { configurable, streamMode: "values" }
        );

        for await (const chunk of graphStream) {
          if ("__interrupt__" in chunk) {
            const payload = (chunk.__interrupt__ as { value: object }[])[0].value;
            send({ type: "interrupt", ...payload });
            return;
          }

          const state = chunk as { emails?: object[]; classifications?: object; decisions?: object[]; cursor?: number };
          if (Array.isArray(state.emails) && state.emails.length > 0) {
            send({
              type: "state",
              emails: state.emails,
              classifications: state.classifications ?? {},
              decisions: state.decisions ?? [],
              cursor: state.cursor ?? 0,
            });
          }
        }

        // Check state for the next pending interrupt (value stream may not surface it).
        const snapshot = await graph.getState({ configurable });
        const pending = (snapshot.tasks ?? []).flatMap(
          (t) => (t.interrupts ?? []) as { value: object }[]
        );
        if (pending.length > 0) {
          send({ type: "interrupt", ...pending[0].value });
          return;
        }

        if (!demoMode && fetchMode === "incremental") {
          await setSetting("lastProcessedAt", new Date().toISOString());
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
