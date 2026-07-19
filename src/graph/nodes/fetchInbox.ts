import type { RunnableConfig } from "@langchain/core/runnables";
import { MOCK_EMAILS } from "@/lib/mock-emails";
import { searchEmails } from "@/lib/gmail";
import type { TriageStateType, GraphConfig } from "@/graph/state";

const BATCH_CAP = 50;

function defaultLookback(): string {
  return new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
}

export async function fetchInbox(
  state: TriageStateType,
  config: RunnableConfig
): Promise<Partial<TriageStateType>> {
  const { demoMode, fetchWindow, googleTokens } = config.configurable as GraphConfig;

  if (demoMode) {
    return { emails: MOCK_EMAILS, cursor: 0 };
  }

  let query: string;
  if (fetchWindow.mode === "backfill") {
    query = `after:${fetchWindow.after} before:${fetchWindow.before}`;
  } else {
    const since = state.lastProcessedAt ?? defaultLookback();
    query = `after:${since}`;
  }

  const emails = await searchEmails(googleTokens!, query, BATCH_CAP);
  return { emails, cursor: 0 };
}
