import { createClient, type Client } from "@libsql/client";
import type { Application, ApplicationEvent, ApplicationStage } from "@/lib/types";
import crypto from "crypto";

// Plain local SQLite via a `file:` URL — no external database service. Only the
// self-host (real Gmail) path persists here; the hosted demo skips the DB entirely.
//
// The client is created lazily (not at module load) so that Next's build-time
// "collecting page data" step never instantiates it — the demo deploy leaves
// DATABASE_URL unset and never calls a DB function, so no client is ever made.
// `||` (not `??`) so an empty-string env var also falls back to the default file.
let _client: Client | null = null;
function db(): Client {
  if (!_client) {
    _client = createClient({ url: process.env.DATABASE_URL || "file:openmail.db" });
  }
  return _client;
}

export async function initDb() {
  await db().execute(`
    CREATE TABLE IF NOT EXISTS applications (
      id          TEXT PRIMARY KEY,
      company     TEXT NOT NULL,
      role        TEXT,
      applied_at  TEXT NOT NULL
    )
  `);
  await db().execute(`
    CREATE TABLE IF NOT EXISTS application_events (
      id             TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      stage          TEXT NOT NULL,
      label          TEXT NOT NULL,
      summary        TEXT,
      at             TEXT NOT NULL,
      email_id       TEXT,
      email_from     TEXT,
      email_subject  TEXT,
      email_body     TEXT
    )
  `);
  await db().execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);
}

// ── Settings kv ───────────────────────────────────────────────────────────────
export async function getSetting(key: string): Promise<string | null> {
  const result = await db().execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [key] });
  return result.rows.length ? (result.rows[0].value as string) : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db().execute({
    sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
    args: [key, value, value],
  });
}

// ── Applications + timeline events ────────────────────────────────────────────

export async function getApplications(): Promise<Application[]> {
  const appsRes = await db().execute("SELECT * FROM applications ORDER BY applied_at DESC");
  const evRes = await db().execute("SELECT * FROM application_events ORDER BY at ASC");

  const eventsByApp = new Map<string, ApplicationEvent[]>();
  for (const r of evRes.rows) {
    const appId = r.application_id as string;
    const list = eventsByApp.get(appId) ?? [];
    list.push({
      id: r.id as string,
      stage: r.stage as ApplicationStage,
      label: r.label as string,
      summary: r.summary as string | null,
      at: r.at as string,
      emailId: r.email_id as string | null,
      emailFrom: (r.email_from as string | null) ?? null,
      emailSubject: (r.email_subject as string | null) ?? null,
      emailBody: (r.email_body as string | null) ?? null,
    });
    eventsByApp.set(appId, list);
  }

  return appsRes.rows.map((r) => ({
    id: r.id as string,
    company: r.company as string,
    role: r.role as string | null,
    appliedAt: r.applied_at as string,
    events: eventsByApp.get(r.id as string) ?? [],
  }));
}

export async function createApplication(company: string, role: string | null): Promise<string> {
  const id = crypto.randomUUID();
  await db().execute({
    sql: "INSERT INTO applications (id, company, role, applied_at) VALUES (?, ?, ?, ?)",
    args: [id, company, role, new Date().toISOString()],
  });
  return id;
}

export async function deleteApplication(id: string): Promise<void> {
  await db().execute({ sql: "DELETE FROM application_events WHERE application_id = ?", args: [id] });
  await db().execute({ sql: "DELETE FROM applications WHERE id = ?", args: [id] });
}

const DEFAULT_LABEL: Record<ApplicationStage, string> = {
  applied: "Applied",
  interview: "Interview",
  assessment: "Technical test",
  offer: "Offer",
  rejected: "Rejected",
  update: "Update",
};

// Adds a timeline event. Interviews are auto-numbered ("Interview 1", "Interview 2").
export type EventEmail = { id: string; from: string; subject: string; body: string };

export async function addApplicationEvent(
  applicationId: string,
  stage: ApplicationStage,
  summary: string | null,
  email: EventEmail | null = null,
  at: string = new Date().toISOString()
): Promise<void> {
  let label = DEFAULT_LABEL[stage];
  if (stage === "interview") {
    const countRes = await db().execute({
      sql: "SELECT COUNT(*) as n FROM application_events WHERE application_id = ? AND stage = 'interview'",
      args: [applicationId],
    });
    const n = Number(countRes.rows[0]?.n ?? 0) + 1;
    label = `Interview ${n}`;
  }
  await db().execute({
    sql: `INSERT INTO application_events
          (id, application_id, stage, label, summary, at, email_id, email_from, email_subject, email_body)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(), applicationId, stage, label, summary, at,
      email?.id ?? null, email?.from ?? null, email?.subject ?? null, email?.body ?? null,
    ],
  });
}

export async function deleteApplicationEvent(eventId: string): Promise<void> {
  await db().execute({ sql: "DELETE FROM application_events WHERE id = ?", args: [eventId] });
}

// Fuzzy-ish match: same company (case-insensitive), optionally same role.
export async function findApplicationId(company: string, role: string | null): Promise<string | null> {
  const result = await db().execute({
    sql: "SELECT id, role FROM applications WHERE lower(company) = lower(?)",
    args: [company],
  });
  if (!result.rows.length) return null;
  if (role) {
    const roleMatch = result.rows.find(
      (r) => (r.role as string | null)?.toLowerCase() === role.toLowerCase()
    );
    if (roleMatch) return roleMatch.id as string;
  }
  return result.rows[0].id as string;
}
