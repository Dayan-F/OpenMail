import type { RunnableConfig } from "@langchain/core/runnables";
import type { TriageStateType, GraphConfig } from "@/graph/state";

export async function flag(
  state: TriageStateType,
  config: RunnableConfig
): Promise<Partial<TriageStateType>> {
  const { demoMode, googleTokens } = config.configurable as GraphConfig;
  const email = state.emails[state.cursor];

  if (!demoMode && googleTokens) {
    await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/modify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleTokens.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ addLabelIds: ["SPAM"], removeLabelIds: ["INBOX"] }),
      }
    );
  }

  return {
    decisions: [{ id: email.id, action: "flagged", at: new Date().toISOString() }],
  };
}
