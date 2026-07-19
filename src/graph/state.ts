import { Annotation } from "@langchain/langgraph";
import type { EmailMeta, Category, Decision, FetchWindow } from "@/lib/types";
import type { LLMConfig } from "@/lib/llm";
import type { GoogleTokens } from "@/lib/session";

export const TriageState = Annotation.Root({
  emails: Annotation<EmailMeta[]>,
  classifications: Annotation<Record<string, Category>>,
  drafts: Annotation<Record<string, string>>,
  replyContext: Annotation<Record<string, unknown>>,
  cursor: Annotation<number>,
  lastAction: Annotation<"approve" | "edit" | "skip" | null>,
  decisions: Annotation<Decision[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  userVoice: Annotation<string>,
  lastProcessedAt: Annotation<string | null>,
});

export type TriageStateType = typeof TriageState.State;

// Passed via config.configurable — run-level settings, not graph state
export type GraphConfig = {
  demoMode: boolean;
  llmConfig: LLMConfig;
  fetchWindow: FetchWindow;
  googleTokens?: GoogleTokens;
};
