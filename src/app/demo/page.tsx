"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { InboxTab } from "@/components/InboxTab";
import { ApplicationsBoard } from "@/components/ApplicationsBoard";
import type { EmailMeta, Category, Decision, FetchWindow, Application, ApplicationStage } from "@/lib/types";

type Tab = "inbox" | "applications";
type InterruptPayload = { emailId: string; emailFrom: string; emailSubject: string; draft: string };
type SSEEvent =
  | { type: "state"; emails: EmailMeta[]; classifications: Record<string, Category>; decisions: Decision[]; cursor: number }
  | { type: "interrupt"; emailId: string; emailFrom: string; emailSubject: string; draft: string }
  | { type: "done" }
  | { type: "error"; message: string };

const DEFAULT_LABEL: Record<ApplicationStage, string> = {
  applied: "Applied", interview: "Interview", assessment: "Technical test",
  offer: "Offer", rejected: "Rejected", update: "Update",
};
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const ev = (
  stage: ApplicationStage,
  label: string,
  summary: string | null,
  d: number,
  mail?: { from: string; subject: string; body: string }
) => ({
  id: crypto.randomUUID(), stage, label, summary, at: daysAgo(d), emailId: mail ? "demo" : null,
  emailFrom: mail?.from ?? null, emailSubject: mail?.subject ?? null, emailBody: mail?.body ?? null,
});

const DEMO_APPLICATIONS: Application[] = [
  {
    id: "1", company: "Acme Corp", role: "Senior Frontend Engineer", appliedAt: daysAgo(10),
    events: [
      ev("applied", "Applied", "Application submitted", 10),
      ev("interview", "Interview 1", "Recruiter screen scheduled", 7, {
        from: "sarah.chen@acmecorp.com",
        subject: "Re: Your application for Senior Frontend Engineer",
        body: "Hi,\n\nWe were impressed by your portfolio and would love to schedule a technical interview. Are you available for a 45-minute video call next week?\n\nSarah Chen\nTalent Acquisition, Acme Corp",
      }),
      ev("assessment", "Technical test", "Take-home coding challenge sent", 3, {
        from: "sarah.chen@acmecorp.com",
        subject: "Acme Corp — Technical assessment",
        body: "Hi,\n\nGreat speaking with you! The next step is a short take-home challenge. You'll have 3 days to complete it. Link attached.\n\nBest,\nSarah",
      }),
    ],
  },
  {
    id: "2", company: "BigTech", role: "Staff Engineer", appliedAt: daysAgo(14),
    events: [
      ev("applied", "Applied", null, 14),
      ev("interview", "Interview 1", "Phone screen", 10),
      ev("interview", "Interview 2", "Onsite loop", 5),
      ev("offer", "Offer", "Offer extended 🎉", 1, {
        from: "recruiting@bigtech.com",
        subject: "Your offer from BigTech",
        body: "Congratulations! We're thrilled to extend an offer for the Staff Engineer role. Total compensation $320k. Please review the attached details and let us know if you have questions.",
      }),
    ],
  },
  {
    id: "3", company: "TechStartup", role: "Full Stack Engineer", appliedAt: daysAgo(12),
    events: [
      ev("applied", "Applied", null, 12),
      ev("rejected", "Rejected", "Moving forward with other candidates", 6),
    ],
  },
];

export default function DemoPage() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [emails, setEmails] = useState<EmailMeta[]>([]);
  const [classifications, setClassifications] = useState<Record<string, Category>>({});
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [pendingDraft, setPendingDraft] = useState<InterruptPayload | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>(DEMO_APPLICATIONS);
  const [error, setError] = useState<string | null>(null);
  const [onDemandDrafts, setOnDemandDrafts] = useState<Record<string, string>>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  async function consumeStream(response: Response) {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop()!;
      for (const block of blocks) {
        const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        const event: SSEEvent = JSON.parse(dataLine.slice(6));
        if (event.type === "state") {
          if (Array.isArray(event.emails) && event.emails.length) setEmails(event.emails);
          if (event.classifications) setClassifications(event.classifications);
          if (Array.isArray(event.decisions)) setDecisions(event.decisions);
        } else if (event.type === "interrupt") {
          setPendingDraft({ emailId: event.emailId, emailFrom: event.emailFrom, emailSubject: event.emailSubject, draft: event.draft });
          setIsRunning(false);
        } else if (event.type === "done") {
          setCheckedAt(new Date().toISOString()); setIsRunning(false);
        } else if (event.type === "error") {
          setError(event.message); setIsRunning(false);
        }
      }
    }
  }

  async function handleRun(fetchWindow: FetchWindow) {
    setIsRunning(true); setError(null); setPendingDraft(null);
    setEmails([]); setClassifications({}); setDecisions([]); setOnDemandDrafts({});
    const res = await fetch("/api/graph/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fetchWindow, demoMode: true }),
    });
    if (!res.ok) { const { error: msg } = await res.json(); setError(msg); setIsRunning(false); return; }
    await consumeStream(res);
  }

  const handleDecision = useCallback(async (decision: { action: "approve" | "edit" | "skip"; editedBody?: string }) => {
    setIsRunning(true); setPendingDraft(null);
    const res = await fetch("/api/graph/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(decision),
    });
    if (!res.ok) { setError("Resume failed"); setIsRunning(false); return; }
    await consumeStream(res);
  }, []);

  // On-demand draft (works in demo too — /api/draft uses the demo/session key, /api/send is a no-op)
  async function handleGenerateDraft(email: EmailMeta) {
    setGeneratingId(email.id); setError(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: email.from, subject: email.subject, body: email.body }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({ error: "Draft failed" })); setError(d.error); return; }
      const { draft } = await res.json();
      setOnDemandDrafts((prev) => ({ ...prev, [email.id]: draft }));
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleOnDemandDecision(email: EmailMeta, decision: { action: "approve" | "edit" | "skip"; editedBody?: string }) {
    if (decision.action === "skip") {
      setOnDemandDrafts((prev) => { const n = { ...prev }; delete n[email.id]; return n; });
      return;
    }
    const body = decision.action === "edit" ? (decision.editedBody ?? "") : onDemandDrafts[email.id];
    setGeneratingId(email.id);
    try {
      await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email.from, subject: email.subject, body, threadId: email.threadId, messageId: email.messageId }),
      });
      setDecisions((prev) => [
        ...prev.filter((d) => d.id !== email.id),
        { id: email.id, action: decision.action === "edit" ? "edited" : "sent", at: new Date().toISOString() },
      ]);
      setOnDemandDrafts((prev) => { const n = { ...prev }; delete n[email.id]; return n; });
    } finally {
      setGeneratingId(null);
    }
  }

  // Demo applications: pure local state, no DB
  const blankEvent = (stage: ApplicationStage, label: string) => ({
    id: crypto.randomUUID(), stage, label, summary: null, at: new Date().toISOString(),
    emailId: null, emailFrom: null, emailSubject: null, emailBody: null,
  });
  const addApp = (company: string, role: string) =>
    setApplications((p) => [
      { id: crypto.randomUUID(), company, role: role || null, appliedAt: new Date().toISOString(), events: [blankEvent("applied", "Applied")] },
      ...p,
    ]);
  const deleteApp = (id: string) => setApplications((p) => p.filter((a) => a.id !== id));
  const addEvent = (appId: string, stage: ApplicationStage) =>
    setApplications((p) =>
      p.map((a) => {
        if (a.id !== appId) return a;
        const label = stage === "interview"
          ? `Interview ${a.events.filter((e) => e.stage === "interview").length + 1}`
          : DEFAULT_LABEL[stage];
        return { ...a, events: [...a.events, blankEvent(stage, label)] };
      })
    );
  const deleteEvent = (eventId: string) =>
    setApplications((p) => p.map((a) => ({ ...a, events: a.events.filter((e) => e.id !== eventId) })));

  return (
    <div className="min-h-screen flex flex-col">
      <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-4">
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← Back to home
        </Link>
        <TopBar isRunning={isRunning} checkedAt={checkedAt} onRun={handleRun} demoMode />
        {error && (
          <div className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2 space-y-1">
            <p>{error}</p>
            <Link href="/setup" className="text-xs underline underline-offset-2 hover:text-red-200">
              Connect your AI →
            </Link>
          </div>
        )}
        <div className="flex gap-1 border-b border-gray-800">
          {(["inbox", "applications"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${tab === t ? "border-indigo-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
              {t}
            </button>
          ))}
        </div>
        {tab === "inbox" && (
          <InboxTab
            emails={emails}
            classifications={classifications}
            decisions={decisions}
            pendingDraft={pendingDraft}
            isRunning={isRunning}
            onDecision={handleDecision}
            onDemandDrafts={onDemandDrafts}
            generatingId={generatingId}
            onGenerateDraft={handleGenerateDraft}
            onDemandDecision={handleOnDemandDecision}
          />
        )}
        {tab === "applications" && (
          <ApplicationsBoard applications={applications} onAdd={addApp} onDelete={deleteApp} onAddEvent={addEvent} onDeleteEvent={deleteEvent} />
        )}
      </div>
    </div>
  );
}
