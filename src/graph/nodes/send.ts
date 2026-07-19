import type { RunnableConfig } from "@langchain/core/runnables";
import { sendReply } from "@/lib/gmail";
import type { TriageStateType, GraphConfig } from "@/graph/state";

export async function send(
  state: TriageStateType,
  config: RunnableConfig
): Promise<Partial<TriageStateType>> {
  const { demoMode, googleTokens } = config.configurable as GraphConfig;
  const email = state.emails[state.cursor];
  const body = state.drafts[email.id] ?? "";

  if (!demoMode && googleTokens) {
    const subject = email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`;
    await sendReply(googleTokens, email.from, subject, body, {
      threadId: email.threadId,
      inReplyTo: email.messageId,
    });
  }

  const action = state.lastAction === "edit" ? "edited" : "sent";

  return {
    decisions: [{ id: email.id, action, at: new Date().toISOString() }],
    lastProcessedAt: new Date().toISOString(),
  };
}
