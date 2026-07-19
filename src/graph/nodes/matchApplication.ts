import type { RunnableConfig } from "@langchain/core/runnables";
import type { TriageStateType, GraphConfig } from "@/graph/state";
import { findApplicationId } from "@/lib/db";
import type { JobReply } from "@/lib/schemas";

export async function matchApplication(
  state: TriageStateType,
  config: RunnableConfig
): Promise<Partial<TriageStateType>> {
  const { demoMode } = config.configurable as GraphConfig;
  const email = state.emails[state.cursor];
  const extracted = state.replyContext[email.id] as JobReply | undefined;
  if (!extracted) return {};

  if (demoMode) return {};

  const matchId = await findApplicationId(extracted.company, extracted.role);

  return {
    replyContext: {
      ...state.replyContext,
      [`${email.id}:match`]: matchId,
    },
  };
}
