import type { RunnableConfig } from "@langchain/core/runnables";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { makeModel } from "@/lib/llm";
import { JobReplySchema } from "@/lib/schemas";
import type { TriageStateType, GraphConfig } from "@/graph/state";

const SYSTEM = `Extract structured information from this job-related email.
Return JSON matching exactly: { "company": string, "role": string | null, "stage": string, "summary": string }

"stage" must be one of:
- "applied": application received / acknowledged
- "interview": invitation to or scheduling of an interview round
- "assessment": a technical test, take-home, or coding challenge
- "offer": a job offer or acceptance
- "rejected": a rejection
- "update": any other status update

"summary" = one short sentence describing what this email is about.`;

export async function jobExtract(
  state: TriageStateType,
  config: RunnableConfig
): Promise<Partial<TriageStateType>> {
  const { llmConfig } = config.configurable as GraphConfig;
  const model = makeModel(llmConfig);
  const email = state.emails[state.cursor];

  let parsed = null;
  let lastError: unknown;

  // Retry up to 3 times — small Ollama models are flaky with strict JSON
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await model.invoke([
      new SystemMessage(SYSTEM),
      new HumanMessage(`From: ${email.from}\nSubject: ${email.subject}\n\n${email.body}`),
    ]);

    const text = (response.content as string).trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) continue;

    const result = JobReplySchema.safeParse(JSON.parse(jsonMatch[0]));
    if (result.success) {
      parsed = result.data;
      break;
    }
    lastError = result.error;
  }

  if (!parsed) {
    console.error("jobExtract: failed to parse after 3 attempts", lastError);
    return {};
  }

  return {
    replyContext: {
      ...state.replyContext,
      [email.id]: parsed,
    },
  };
}
