import { interrupt } from "@langchain/langgraph";
import type { TriageStateType } from "@/graph/state";

type UserDecision =
  | { action: "approve" }
  | { action: "edit"; editedBody: string }
  | { action: "skip" };

export function reviewGate(state: TriageStateType): Partial<TriageStateType> {
  const email = state.emails[state.cursor];

  // First call: throws an interrupt signal — graph freezes, payload goes to the API.
  // Second call (after /api/graph/resume): returns whatever the client passed to Command.resume.
  const decision = interrupt({
    emailId: email.id,
    emailFrom: email.from,
    emailSubject: email.subject,
    draft: state.drafts[email.id],
  }) as UserDecision;

  if (decision.action === "skip") {
    return {
      lastAction: "skip",
      decisions: [{ id: email.id, action: "skipped", at: new Date().toISOString() }],
    };
  }

  if (decision.action === "edit") {
    return {
      lastAction: "edit",
      drafts: { ...state.drafts, [email.id]: decision.editedBody },
    };
  }

  return { lastAction: "approve" };
}
