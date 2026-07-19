"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { InboxTab } from "@/components/InboxTab";
import { ApplicationsBoard } from "@/components/ApplicationsBoard";
import type { EmailMeta, Category, Decision, FetchWindow, Application, ApplicationStage } from "@/lib/types";

type Tab = "inbox" | "applications";

type InterruptPayload = {
  emailId: string;
  emailFrom: string;
  emailSubject: string;
  draft: string;
};

type SSEEvent =
  | { type: "state"; emails: EmailMeta[]; classifications: Record<string, Category>; decisions: Decision[]; cursor: number }
  | { type: "interrupt"; emailId: string; emailFrom: string; emailSubject: string; draft: string }
  | { type: "done" }
  | { type: "error"; message: string };

export default function InboxPage() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [emails, setEmails] = useState<EmailMeta[]>([]);
  const [classifications, setClassifications] = useState<Record<string, Category>>({});
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [pendingDraft, setPendingDraft] = useState<InterruptPayload | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorNeedsConfig, setErrorNeedsConfig] = useState(false);
  const [onDemandDrafts, setOnDemandDrafts] = useState<Record<string, string>>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/applications").then((r) => r.json()).then(setApplications).catch(() => {});
  }, []);

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
          setCheckedAt(new Date().toISOString());
          setIsRunning(false);
          fetch("/api/applications").then((r) => r.json()).then(setApplications).catch(() => {});
        } else if (event.type === "error") {
          setError(event.message);
          setErrorNeedsConfig(false);   // runtime error — not a config problem
          setIsRunning(false);
        }
      }
    }
  }

  async function handleRun(fetchWindow: FetchWindow) {
    setIsRunning(true);
    setError(null);
    setErrorNeedsConfig(false);
    setPendingDraft(null);
    setEmails([]);
    setClassifications({});
    setDecisions([]);

    const res = await fetch("/api/graph/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fetchWindow }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Run failed" }));
      setError(data.error);
      setErrorNeedsConfig(Boolean(data.needsSetup || data.needsAuth));  // only config errors show links
      setIsRunning(false);
      return;
    }

    await consumeStream(res);
  }

  const handleDecision = useCallback(async (decision: { action: "approve" | "edit" | "skip"; editedBody?: string }) => {
    setIsRunning(true);
    setPendingDraft(null);

    const res = await fetch("/api/graph/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(decision),
    });

    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: "Resume failed" }));
      setError(msg);
      setErrorNeedsConfig(false);
      setIsRunning(false);
      return;
    }

    await consumeStream(res);
  }, []);

  async function handleAddApplication(company: string, role: string) {
    await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, role }),
    });
    const updated = await fetch("/api/applications").then((r) => r.json());
    setApplications(updated);
  }

  async function handleDeleteApplication(id: string) {
    setApplications((prev) => prev.filter((a) => a.id !== id));  // optimistic
    await fetch("/api/applications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function refreshApplications() {
    const updated = await fetch("/api/applications").then((r) => r.json());
    setApplications(updated);
  }

  async function handleAddEvent(applicationId: string, stage: ApplicationStage) {
    await fetch("/api/applications/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, stage }),
    });
    await refreshApplications();
  }

  async function handleDeleteEvent(eventId: string) {
    await fetch("/api/applications/event", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    await refreshApplications();
  }

  // On-demand: generate a draft for a single email (e.g. one you skipped).
  async function handleGenerateDraft(email: EmailMeta) {
    setGeneratingId(email.id);
    setError(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: email.from, subject: email.subject, body: email.body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Draft failed" }));
        setError(data.error);
        setErrorNeedsConfig(Boolean(data.needsSetup));
        return;
      }
      const { draft } = await res.json();
      setOnDemandDrafts((prev) => ({ ...prev, [email.id]: draft }));
    } finally {
      setGeneratingId(null);
    }
  }

  // On-demand: act on a generated draft — send / send edited / discard.
  async function handleOnDemandDecision(
    email: EmailMeta,
    decision: { action: "approve" | "edit" | "skip"; editedBody?: string }
  ) {
    if (decision.action === "skip") {
      setOnDemandDrafts((prev) => { const n = { ...prev }; delete n[email.id]; return n; });
      return;
    }
    const body = decision.action === "edit" ? (decision.editedBody ?? "") : onDemandDrafts[email.id];
    setGeneratingId(email.id);
    setError(null);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email.from,
          subject: email.subject,
          body,
          threadId: email.threadId,
          messageId: email.messageId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Send failed" }));
        setError(data.error);
        setErrorNeedsConfig(false);
        return;
      }
      // Mark as sent locally and clear the draft
      setDecisions((prev) => [
        ...prev.filter((d) => d.id !== email.id),
        { id: email.id, action: decision.action === "edit" ? "edited" : "sent", at: new Date().toISOString() },
      ]);
      setOnDemandDrafts((prev) => { const n = { ...prev }; delete n[email.id]; return n; });
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-4">
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← Back to home
        </Link>
        <TopBar isRunning={isRunning} checkedAt={checkedAt} onRun={handleRun} />

        {error && (
          <div className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2 space-y-1">
            <p>{error}</p>
            {errorNeedsConfig && (
              <p className="text-xs text-red-300/70">
                <a href="/setup" className="underline underline-offset-2 hover:text-red-200">Open Setup</a>
                {" · "}
                <a href="/api/auth/google" className="underline underline-offset-2 hover:text-red-200">Connect Gmail</a>
              </p>
            )}
          </div>
        )}

        <div className="flex gap-1 border-b border-gray-800">
          {(["inbox", "applications"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-indigo-500 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
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
          <ApplicationsBoard
            applications={applications}
            onAdd={handleAddApplication}
            onDelete={handleDeleteApplication}
            onAddEvent={handleAddEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        )}
      </div>
    </div>
  );
}
