import type { RunnableConfig } from "@langchain/core/runnables";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { makeModel } from "@/lib/llm";
import type { TriageStateType, GraphConfig } from "@/graph/state";
import type { Category } from "@/lib/types";

const SYSTEM = `Classify each email into exactly one category:
- reply: a personal email from a real person that needs a response
- fyi: informational only — bills, receipts, shipping, account notices
- newsletter: marketing emails, digests, or subscriptions
- spam: unsolicited promotional or scammy email
- job: from a company or recruiter about a specific job application or role

Return ONLY a JSON object mapping each email ID to its category.
Example: {"id1": "reply", "id2": "newsletter"}`;

export async function classify(
  state: TriageStateType,
  config: RunnableConfig
): Promise<Partial<TriageStateType>> {
  const { llmConfig } = config.configurable as GraphConfig;
  const model = makeModel(llmConfig);

  const emailList = state.emails
    .map((e) => `ID: ${e.id}\nFrom: ${e.from}\nSubject: ${e.subject}\nSnippet: ${e.snippet}`)
    .join("\n---\n");

  const response = await model.invoke([
    new SystemMessage(SYSTEM),
    new HumanMessage(emailList),
  ]);

  const text = (response.content as string).trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { classifications: {} };

  const raw = JSON.parse(jsonMatch[0]) as Record<string, string>;
  const valid = ["reply", "fyi", "newsletter", "spam", "job"];

  const classifications: Record<string, Category> = {};
  for (const [id, cat] of Object.entries(raw)) {
    if (valid.includes(cat)) classifications[id] = cat as Category;
  }

  return { classifications };
}
