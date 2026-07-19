import type { RunnableConfig } from "@langchain/core/runnables";
import type { TriageStateType, GraphConfig } from "@/graph/state";
import { createApplication, addApplicationEvent } from "@/lib/db";
import type { JobReply } from "@/lib/schemas";

export async function updateTracker(
  state: TriageStateType,
  config: RunnableConfig
): Promise<Partial<TriageStateType>> {
  const { demoMode } = config.configurable as GraphConfig;
  const email = state.emails[state.cursor];
  const extracted = state.replyContext[email.id] as JobReply | undefined;
  if (!extracted) return {};

  if (demoMode) return {};

  let appId = state.replyContext[`${email.id}:match`] as string | null;

  // No existing application → create one seeded from this email.
  if (!appId) {
    appId = await createApplication(extracted.company, extracted.role);
  }

  // Append this email as a timeline event (interviews auto-numbered in the DB).
  await addApplicationEvent(appId, extracted.stage, extracted.summary, {
    id: email.id,
    from: email.from,
    subject: email.subject,
    body: email.body,
  });

  return {};
}
