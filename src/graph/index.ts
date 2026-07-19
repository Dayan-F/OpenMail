import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { TriageState, type TriageStateType } from "@/graph/state";
import { fetchInbox } from "@/graph/nodes/fetchInbox";
import { classify } from "@/graph/nodes/classify";
import { draft } from "@/graph/nodes/draft";
import { reviewGate } from "@/graph/nodes/reviewGate";
import { send } from "@/graph/nodes/send";
import { archive } from "@/graph/nodes/archive";
import { flag } from "@/graph/nodes/flag";
import { jobExtract } from "@/graph/nodes/jobExtract";
import { matchApplication } from "@/graph/nodes/matchApplication";
import { updateTracker } from "@/graph/nodes/updateTracker";
import { nextEmail } from "@/graph/nodes/nextEmail";

// ── Routing functions ────────────────────────────────────────────────────────

function routeEmail(state: TriageStateType): string {
  if (state.cursor >= state.emails.length) return "done";
  const email = state.emails[state.cursor];
  const category = state.classifications[email.id] ?? "fyi";
  switch (category) {
    case "reply":      return "draft";
    case "fyi":
    case "newsletter": return "archive";
    case "spam":       return "flag";
    case "job":        return "jobExtract";
    default:           return "archive";
  }
}

function afterReview(state: TriageStateType): string {
  return state.lastAction === "skip" ? "nextEmail" : "send";
}

// ── Graph ────────────────────────────────────────────────────────────────────

const builder = new StateGraph(TriageState)
  // Nodes
  .addNode("fetchInbox",        fetchInbox)
  .addNode("classify",          classify)
  .addNode("route",             (_state: TriageStateType) => ({}))  // routing hub, no state change
  .addNode("draft",             draft)
  .addNode("reviewGate",        reviewGate)
  .addNode("send",              send)
  .addNode("archive",           archive)
  .addNode("flag",              flag)
  .addNode("jobExtract",        jobExtract)
  .addNode("matchApplication",  matchApplication)
  .addNode("updateTracker",     updateTracker)
  .addNode("nextEmail",         nextEmail)

  // Linear edges
  .addEdge(START,               "fetchInbox")
  .addEdge("fetchInbox",        "classify")
  .addEdge("classify",          "route")
  .addEdge("draft",             "reviewGate")
  .addEdge("send",              "nextEmail")
  .addEdge("archive",           "nextEmail")
  .addEdge("flag",              "nextEmail")
  .addEdge("jobExtract",        "matchApplication")
  .addEdge("matchApplication",  "updateTracker")
  .addEdge("updateTracker",     "nextEmail")
  .addEdge("nextEmail",         "route")

  // Conditional edges
  .addConditionalEdges("route", routeEmail, {
    draft:       "draft",
    archive:     "archive",
    flag:        "flag",
    jobExtract:  "jobExtract",
    done:        END,
  })
  .addConditionalEdges("reviewGate", afterReview, {
    send:      "send",
    nextEmail: "nextEmail",
  });

export const graph = builder.compile({
  checkpointer: new MemorySaver(),
  interruptBefore: [],
  interruptAfter: [],
});
