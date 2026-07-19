import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { makeModel, type LLMConfig } from "@/lib/llm";
import type { EmailMeta } from "@/lib/types";

// Shared draft generation — used by both the graph `draft` node and the
// on-demand /api/draft endpoint (re-drafting a skipped email).
export async function draftReply(
  llmConfig: LLMConfig,
  email: Pick<EmailMeta, "from" | "subject" | "body">,
  userVoice?: string
): Promise<string> {
  const model = makeModel(llmConfig);

  const voiceSection = userVoice ? `\n\nMatch this writing style:\n${userVoice}` : "";
  const system = `You are drafting a reply to an email on behalf of the user.
Write a concise, genuine reply. Do not use hollow filler phrases.
Sign off simply — no name needed.${voiceSection}`;

  const response = await model.invoke([
    new SystemMessage(system),
    new HumanMessage(`From: ${email.from}\nSubject: ${email.subject}\n\n${email.body}`),
  ]);

  return response.content as string;
}
