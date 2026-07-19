# OpenMail

An agentic email assistant built on **LangGraph.js**. A single run over your inbox does two
jobs at once: it **triages mail** (classify → draft → human-approve → send) and it **tracks job
applications** — building a per-company timeline of events (applied → interview → technical test →
offer/rejected) from the emails you receive. Human-in-the-loop by design — nothing is ever sent
without a tap.

All TypeScript, single Next.js app. Ships as a self-host template plus a no-login demo.

---

## What it does

A single `classify` pass over the fetched batch routes each email:

- `reply` → drafts a response, then **pauses for your approval** (approve / edit / skip)
- `fyi` / `newsletter` → archived automatically
- `spam` → flagged automatically
- `job` → the LLM classifies the email into a **stage** (applied / interview / assessment /
  offer / rejected / update) and appends it to that company's application timeline

Two tabs share one screen:

- **Inbox** (ephemeral, per-run): the batch as a list with a category chip per email. Reply-needed
  ones open a draft card with approve / edit / skip. Every email also has a **Generate reply**
  button for drafting on demand.
- **Applications** (persistent): a card per company showing an **event timeline** built from your
  emails. Click any step to read the source email. Multiple interviews auto-number ("Interview 1",
  "Interview 2"). You can also add/remove stages manually and seed applications yourself.

### How the graph works

```
fetchInbox → classify → route ─┬─ reply → draft → reviewGate [interrupt] → send ─┐
                               ├─ fyi/newsletter → archive                       │
                               ├─ spam → flag                                    │
                               └─ job → jobExtract → matchApplication → updateTracker
                               ▲                                                 │
                               └──────────────── nextEmail (cursor++) ◄──────────┘
                               (route exits to END when the batch is exhausted)
```

`reviewGate` calls LangGraph's `interrupt()`: the graph freezes in the checkpointer and the API
returns the pending draft. Your approve/edit/skip resumes the same `thread_id`. One run can pause
multiple times — once per reply-needed email. See `src/graph/` for the nodes and `src/graph/index.ts`
for the wiring.

---

## Stack

| Concern | Choice |
| --- | --- |
| Orchestration | `@langchain/langgraph` (StateGraph, conditional edges, `interrupt()`, checkpointer) |
| LLM (default) | `@langchain/groq` — bring your own key |
| LLM (private) | Ollama via `@langchain/openai` pointed at `localhost:11434/v1` |
| Frontend | Next.js (App Router), React 19, Tailwind v4 |
| Persistence | SQLite via `@libsql/client` (applications + settings) |

---

## Quick start

Requires **Node 18+**. Install and configure:

```bash
npm install
cp .env.example .env
```

Then generate a session secret and paste it into `.env` as `SESSION_SECRET`:

```bash
openssl rand -hex 32
```

### Run it

```bash
npm run dev          # development, http://localhost:3000
# or
npm run build && npm run start    # production build
```

There are **two ways to test** — the demo (fastest) or the full self-host path.

---

## Option A — Demo mode (fastest, no Google login)

Demo mode uses a canned inbox (`src/lib/mock-emails.ts`). Classify, route, draft, and the approval
gate all run for real against your LLM key; `send` is a logged no-op. This is the quickest way to see
the whole graph work.

1. Add an LLM key to `.env`:

   ```bash
   DEMO_GROQ_API_KEY=gsk_your_groq_key_here
   ```

   Get a free key at <https://console.groq.com/keys>.

2. Start the app and open the demo:

   ```bash
   npm run dev
   ```

   Go to <http://localhost:3000/demo> and click **Run now**. Watch the emails get classified, then
   the graph pauses on each reply-needed email for you to approve / edit / skip.

---

## Option B — Full self-host (your real Gmail)

Gmail send/modify are **restricted scopes**. Rather than go through Google's verification, you run
your **own** OAuth app with yourself as the only test user — the personal-use path, no verification
needed.

### 1. Create a Google Cloud project

Go to <https://console.cloud.google.com/> → create a new project.

### 2. Enable the Gmail API

APIs & Services → Library → search "Gmail API" → **Enable**.

### 3. Configure the OAuth consent screen

APIs & Services → OAuth consent screen → **External** → fill in app name + your email. Under
**Test users**, add your own Google account. Leave the app in **Testing** (you'll see an
"unverified app" screen when you log in — that's expected for personal use).

### 4. Create OAuth credentials

APIs & Services → Credentials → Create Credentials → **OAuth client ID** → **Web application**.
Add an authorized redirect URI:

```
http://localhost:3000/api/auth/callback
```

Copy the **Client ID** and **Client secret**.

### 5. Fill in `.env`

```bash
GROQ_API_KEY=gsk_your_groq_key_here
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
SESSION_SECRET=paste_openssl_output_here
```

### Then

```bash
npm run dev
```

1. <http://localhost:3000> → **Connect your AI** → paste your Groq key (or switch to Ollama) → **Test connection**.
2. Back on the home hub → **Connect Gmail** → approve the consent screen (click through the
   "unverified app" warning) → you land on **/inbox**.
3. Pick a fetch window (7 / 30 / 90 days) and hit **Run now**.

---

## Privacy option: run the LLM fully local with Ollama

Ollama exposes an OpenAI-compatible API, so no data leaves your machine and no API key is needed —
a real selling point for an email tool.

```bash
# install from https://ollama.com, then:
ollama pull llama3
ollama serve      # serves http://localhost:11434
```

On **/setup**, switch the provider toggle to **Ollama (local)**, set the base URL to
`http://localhost:11434/v1` and the model to `llama3`. Note: small local models are flakier at
strict JSON extraction — the `jobExtract` node validates with Zod and retries, but expect lower
quality than Groq.

---

## Environment variables

| Var | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Your Groq key for the self-host path (also a fallback for the demo) |
| `DEMO_GROQ_API_KEY` | Key that powers `/demo` (can equal `GROQ_API_KEY`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Your OAuth app (self-host) |
| `SESSION_SECRET` | Encrypts the session cookie — any 32+ char random string |
| `DATABASE_URL` | SQLite file, defaults to `file:./openmail.db` |
| `CRON_SECRET` | Shared secret for the daily cron endpoint (`x-cron-secret` header) |

Ollama is configured in the **/setup** UI (base URL + model), so it needs no env vars.

Secrets never enter the repo — `.env` is gitignored. A public repo does not expose them.

---

## Daily incremental runs (cron)

`POST /api/cron` with an `x-cron-secret: <CRON_SECRET>` header triggers an incremental run using the
stored cursor. Point Railway/Render's scheduler (or any cron) at it:

```bash
curl -X POST https://your-host/api/cron -H "x-cron-secret: $CRON_SECRET"
```

The incremental cursor (`lastProcessedAt`) advances only on completed, non-demo, incremental runs;
manual backfill windows never move it.

---

## Deferred (not built in v1)

Auto-detect applications from the Sent folder · draft self-critique loop · parallel classification ·
auto-draft availability replies for positive outcomes · Google verification for public access.
