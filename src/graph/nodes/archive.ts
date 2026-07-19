import type { RunnableConfig } from "@langchain/core/runnables";
import { archiveMessage } from "@/lib/gmail";
import type { TriageStateType, GraphConfig } from "@/graph/state";

export async function archive(
  state: TriageStateType,
  config: RunnableConfig
): Promise<Partial<TriageStateType>> {
  const { demoMode, googleTokens } = config.configurable as GraphConfig;
  const email = state.emails[state.cursor];

  if (!demoMode && googleTokens) {
    await archiveMessage(googleTokens, email.id);
  }

  return {
    decisions: [{ id: email.id, action: "archived", at: new Date().toISOString() }],
  };
}
