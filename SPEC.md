# Inbox Triage + Job Application Tracker — Design Spec

An agentic email assistant built on **LangGraph.js**. A single scheduled run over your
inbox does two jobs at once: it triages mail (classify → draft → human-approve → send)
and it tracks job applications (detect replies → mark positive/negative). Human-in-the-loop
by design: nothing is ever sent without a tap.

Portfolio goal: demonstrate real agent orchestration (stateful graph, conditional routing,
interrupts, checkpointing, structured output) in an all-TypeScript codebase, shippable as an
open-source self-host template plus a no-login demo.

---

## 1. Stack

All TypeScript, single Next.js repo. No Python.

| Concern | Choice |
| --- | --- |
| Orchestration | `@langchain/langgraph` (StateGraph, conditional edges, `interrupt()`, checkpointer, streaming) |
| Gmail access | `@langchain/mcp-adapters` + `@modelcontextprotocol/sdk` (STDIO or Streamable HTTP) |
| LLM (hosted / default) | `@langchain/groq` — user brings their own key |
| LLM (self-host / private) | Ollama via `@langchain/openai` pointed at `localhost:11434/v1` |
| Frontend | Next.js (App Router), React |
| Persistence | SQLite (self-host) or Postgres (hosted) for the applications table + checkpointer |
| Hosting | Railway / Render (long-running Node process — simplest for interrupt/checkpoint) |

---

## 2. Two features, one run

A single `classify` pass over the fetched batch routes each email:

- `reply` / `spam` / `fyi` → **triage branch** → feeds the **Inbox** tab (ephemeral, per-run)
- `job` → **job branch** → feeds the **Applications** tab (persistent, survives every run)

The graph never talks to the UI directly. It writes to two data sources — the run's triage
results (ephemeral) and the applications table (persistent) — and each tab reads its source.
This decoupling is also what makes demo mode trivial.

---

## 3. Triage graph

```
fetchInbox → classify → route ─┬─ reply → draft → reviewGate [interrupt] → send ─┐
                               ├─ fyi/newsletter → archive/label                 │
                               └─ spam → flag                                    │
                                                                                 ↓
                    (route exits to `done` when the batch is exhausted) ←── next email (cursor++)
```

Key points:

- Only `reply` emails reach `send`. `fyi`/`newsletter`/`spam` never enter the human gate.
- `reviewGate` calls `interrupt()`. The graph freezes in the checkpointer and the API returns
  the pending draft. The UI shows approve / edit / skip.
- Resume re-invokes with the same `thread_id`:
  - **approve** → straight into `send`
  - **edit** → `graph.updateState()` swaps in the edited body, then `send`
  - **skip** → record decision, jump to next email, never enter `send`
- Every path appends to a `decisions` log = "what did the agent do today" audit trail.
- The `cursor` loop means one run can pause multiple times, once per reply-needed email.

### Triage state

```typescript
import { Annotation } from "@langchain/langgraph";

type Category = "reply" | "fyi" | "newsletter" | "spam" | "job";
type EmailMeta = { id: string; from: string; subject: string; snippet: string; body: string };
type Decision  = { id: string; action: "sent" | "edited" | "skipped" | "archived"; at: string };

const TriageState = Annotation.Root({
  emails:          Annotation<EmailMeta[]>,
  classifications: Annotation<Record<string, Category>>,
  drafts:          Annotation<Record<string, string>>,
  replyContext:    Annotation<Record<string, unknown>>,   // grounding for the draft node
  cursor:          Annotation<number>,
  decisions:       Annotation<Decision[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  userVoice:       Annotation<string>,                    // style profile / few-shot examples
  lastProcessedAt: Annotation<string | null>,             // incremental cursor (see §5)
});
```

---

## 4. Job application tracking (kept simple: applied / positive / negative)

```
applied ──(reply arrives)──► classify sentiment ─┬─► replied_positive  (interview / offer)
                                                 └─► replied_negative  (rejection)
```

Branch off `route`: `job` email → `jobExtract` → `matchApplication` → `updateTracker`
(flips status). No "needs reply" fork in the simple version; can be added later so a
positive reply auto-drafts an availability response into the existing gate.

### Extraction schema (structured output)

```typescript
import { z } from "zod";

const JobReplySchema = z.object({
  company:   z.string(),
  role:      z.string().nullable(),
  sentiment: z.enum(["positive", "negative"]),   // interview/offer vs rejection
  summary:   z.string(),                          // one line for the card
});
```

### Application record (persistent table, not graph state)

```typescript
type Application = {
  id: string;
  company: string;
  role: string | null;
  status: "applied" | "replied_positive" | "replied_negative";
  repliedAt: string | null;
  summary: string | null;   // filled once a reply is classified
};
```

### Matching an email to an application

Tried in order:
1. Gmail thread / `References` headers if it's a reply in a known thread.
2. Fuzzy match extracted `company` + `role` against existing records.
3. No confident match → create a new record; UI surfaces a "same as X?" merge prompt.

### Seeding (how a record reaches `applied`)

- **v1 — manual seed:** an "add application" button (company + role) creates an `applied` record.
  Reliable, zero matching magic, fine for a portfolio.
- **Later — auto-detect:** mine the Sent folder for outgoing application emails. Noisier;
  ship as a future enhancement.

---

## 5. Fetch window (adjustable in-app)

Two modes share one `fetchInbox` node:

- **Incremental (default, cron):** uses a stored high-water mark (`lastProcessedAt` or Gmail
  `historyId`). Fetches `after:<cursor>`. Slides forward automatically, never double-processes.
- **Backfill (manual):** explicit start/end dates from the UI. Used for onboarding and the
  "scan older mail" control.

```typescript
type FetchWindow =
  | { mode: "backfill"; after: string; before: string }
  | { mode: "incremental" };

async function fetchInbox(state, config: { window: FetchWindow }) {
  const q = config.window.mode === "backfill"
    ? `after:${config.window.after} before:${config.window.before}`
    : `after:${state.lastProcessedAt ?? defaultLookback()}`;  // e.g. last 7 days on first run
  const emails = await gmail.search(q, { maxResults: BATCH_CAP });
  return { emails };
}
```

### UI control

Top-bar presets: **7 days / 30 days / 90 days / custom**. Presets map to `after = today − Nd`;
custom opens two date fields (`after` + `before`).

```typescript
type RangePreset = "7d" | "30d" | "90d" | "custom";

function windowFromPreset(preset: RangePreset, custom?: { after: string; before: string }): FetchWindow {
  if (preset === "custom" && custom) return { mode: "backfill", ...custom };
  const days = { "7d": 7, "30d": 30, "90d": 90 }[preset] ?? 30;
  const after = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  return { mode: "backfill", after, before: today() };
}
```

### Rules that keep it correct

- Manual range = `backfill`; it must **not** advance the incremental cursor, or the next daily
  run thinks it's caught up through today.
- **Idempotency is the real safety net, not the dates.** Key everything on Gmail message ID:
  skip any ID already in the processed set; upsert applications rather than insert. Overlapping
  or sloppy windows then can't create duplicates.
- **Cap matters more than the range.** "90 days" can be hundreds of emails. Enforce a per-run
  `BATCH_CAP` (e.g. 50) and paginate. Show the user "last 30 days, capped at 50".
- Cron runs use the cursor silently (no picker). The picker is only the human "Run now" /
  backfill path. Top bar shows "Checked N min ago" = the cursor timestamp.

---

## 6. LLM provider: Groq or Ollama

Ollama exposes an OpenAI-compatible API, so both providers share one OpenAI-shaped seam.
Build a single factory; nodes never branch on provider.

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";

type LLMConfig =
  | { provider: "groq";   apiKey: string; model: string }
  | { provider: "ollama"; baseUrl: string; model: string };  // http://localhost:11434/v1

function makeModel(cfg: LLMConfig) {
  if (cfg.provider === "groq") return new ChatGroq({ apiKey: cfg.apiKey, model: cfg.model });
  return new ChatOpenAI({
    model: cfg.model,
    apiKey: "ollama",                 // any non-empty string; Ollama ignores it
    configuration: { baseURL: cfg.baseUrl },
  });
}
```

Caveats:

- **Hosted demo can't use Ollama** (no local process, can't reach the user's `localhost`).
  Provider choice: hosted demo → Groq/demo key; self-host → Groq **or** local Ollama.
- **Ollama is the privacy story:** "runs fully local, no API key, no data leaves your machine"
  — a real selling point for an email tool. Document it in the self-host README.
- **Structured output diverges:** small local models are flakier at strict JSON. Use Ollama's
  JSON/format mode, and validate `JobReplySchema` with Zod + retry-on-parse-failure (good
  practice for any provider). Don't assume a tiny model matches Groq's extraction quality.
- Groq stays the friendly default; Ollama is the power-user / privacy option.

---

## 7. Auth & deployment

The Gmail login gotcha is a Google policy wall, not a TypeScript limit. Send/modify are
**restricted scopes**; letting arbitrary strangers log in requires Google verification incl.
an annual third-party security assessment. Until then you fall under the personal-use
exception: app stays in "Testing", only manually-added test users (~100 cap) can log in, and
they see an "unverified app" screen.

Chosen shape: **self-host template + no-login demo.**

- **Self-host:** each user clones the repo, creates their **own** Google Cloud OAuth app, adds
  themselves as the sole test user, brings their own Groq key or local Ollama, runs their own
  instance. No verification needed (each person is the only user of their own project). README
  documents the 5-step OAuth setup — this demonstrates competence rather than hiding it.
- **Demo mode:** no login, no keys. `fetchInbox` returns a canned batch; `send` becomes a
  logged no-op. Everything between (classify/route/draft/gate) runs for real against a
  rate-limited demo key. Both tabs render identically from seeded data.

Secrets never enter the repo — env vars on the host + runtime user input only. Public repo ≠
exposed secrets. GitHub hosts code; a host (Railway/Render) runs the app.

---

## 8. Routes (Next.js App Router)

| Route | Purpose |
| --- | --- |
| `/` | Landing: pitch, "Try the demo", "Connect Gmail" |
| `/demo` | Full UI on mock data, no auth, no keys |
| `/api/auth/google` → `/api/auth/callback` | OAuth start + redirect; store tokens in server session |
| `/setup` | Provider toggle (Groq key vs Ollama URL) + model select, validated with one test call |
| `/inbox` | The two-tab app (Inbox + Applications) |
| `/api/graph/start` | Kick off a run (streams) |
| `/api/graph/resume` | Resume after approve/edit/skip (feeds the interrupt) |

Server session holds: Google tokens, LLM config, `thread_id`, cursor.

---

## 9. UI

Two tabs sharing one top bar (login, fetch-window control, "Run now").

- **Inbox tab (ephemeral):** the run's batch as a list with a category chip per email
  (reply / fyi / newsletter / spam). Opening a reply-needed one shows the draft with
  approve / edit / skip. Spam/FYI just show their chip.
- **Applications tab (persistent):** three columns — **Applied / Replied — positive /
  Replied — negative**. Card per company (company, role, one-line summary once a reply lands).
  Green accent on positive, red on negative. "Add application" button at the top of Applied =
  the manual seed. Persists across every run.
- **Top bar:** fetch-window presets (7/30/90/custom), "Run now", and "Checked N min ago"
  (the cursor timestamp).

---

## 10. Build order / roadmap

1. `makeModel` factory + `/setup` provider toggle (do the seam first so nothing hardcodes a provider).
2. Gmail via MCP + OAuth (self-host path) and demo-mode fake source.
3. Triage graph: `fetchInbox → classify → route → draft → reviewGate(interrupt) → send`, checkpointer.
4. Inbox tab: review card + streaming.
5. Job branch: `jobExtract` (Zod) → `matchApplication` → `updateTracker`; applications table.
6. Applications tab: three-column board + manual-seed button.
7. Fetch-window control + incremental cursor + `BATCH_CAP` + idempotent message-ID set.
8. Cron for daily incremental runs.
9. README: OAuth setup steps, Ollama-for-privacy note, demo link.

### Explicitly deferred (note in README, don't build v1)

- Auto-detect applications from the Sent folder.
- Draft-subgraph self-critique loop (draft → critique → revise).
- Parallel classification via the `Send` API (map-reduce fan-out).
- Auto-draft availability replies for positive job outcomes.
- Google verification for public (non-test-user) access.

---

## 11. What this demonstrates (portfolio framing)

Stateful multi-node graph · conditional routing · nested branches merging into a shared node ·
`interrupt()` + checkpointing for human-in-the-loop · `graph.updateState()` for mid-run edits ·
structured output with schema validation · MCP tool integration · provider abstraction ·
idempotent incremental processing · clean self-host + demo split.
