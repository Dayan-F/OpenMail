import type { RunnableConfig } from "@langchain/core/runnables";
import { draftReply } from "@/lib/draftReply";
import type { TriageStateType, GraphConfig } from "@/graph/state";

export async function draft(
  state: TriageStateType,
  config: RunnableConfig
): Promise<Partial<TriageStateType>> {
  const { llmConfig } = config.configurable as GraphConfig;
  const email = state.emails[state.cursor];

  const body = await draftReply(llmConfig, email, state.userVoice);

  return {
    drafts: { ...state.drafts, [email.id]: body },
  };
}
