"use client";

import { useState, useRef, useEffect } from "react";
import { DraftCard } from "@/components/DraftCard";
import type { EmailMeta, Category, Decision } from "@/lib/types";

const CHIP_STYLE: Record<Category, string> = {
  reply:      "bg-blue-500/20 text-blue-300",
  fyi:        "bg-gray-500/20 text-gray-400",
  newsletter: "bg-purple-500/20 text-purple-300",
  spam:       "bg-red-500/20 text-red-300",
  job:        "bg-green-500/20 text-green-300",
};

const DECISION_LABEL: Record<Decision["action"], string> = {
  sent:     "✓ Sent",
  edited:   "✓ Edited & sent",
  skipped:  "— Skipped",
  archived: "Archived",
  flagged:  "Flagged",
};

const CATEGORY_ORDER: Category[] = ["reply", "job", "fyi", "newsletter", "spam"];

type InterruptPayload = {
  emailId: string;
  emailFrom: string;
  emailSubject: string;
  draft: string;
};

type OnDemandDecision = { action: "approve" | "edit" | "skip"; editedBody?: string };

type Props = {
  emails: EmailMeta[];
  classifications: Record<string, Category>;
  decisions: Decision[];
  pendingDraft: InterruptPayload | null;
  isRunning: boolean;
  onDecision: (d: { action: "approve" | "edit" | "skip"; editedBody?: string }) => void;
  onDemandDrafts?: Record<string, string>;
  generatingId?: string | null;
  onGenerateDraft?: (email: EmailMeta) => void;
  onDemandDecision?: (email: EmailMeta, d: OnDemandDecision) => void;
};

export function InboxTab({
  emails,
  classifications,
  decisions,
  pendingDraft,
  isRunning,
  onDecision,
  onDemandDrafts = {},
  generatingId = null,
  onGenerateDraft,
  onDemandDecision,
}: Props) {
  const [filter, setFilter] = useState<Category | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const decisionMap = Object.fromEntries(decisions.map((d) => [d.id, d]));

  // When the graph pauses on a new email, scroll its draft card into view so
  // skip/approve visibly advances to the next one.
  useEffect(() => {
    if (pendingDraft) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pendingDraft?.emailId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!emails || emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-600">
        {isRunning ? "Fetching emails…" : "Hit Run now to fetch your inbox."}
      </div>
    );
  }

  // Count per category (only categories that actually appear get a filter button)
  const counts = emails.reduce<Record<string, number>>((acc, e) => {
    const c = classifications[e.id];
    if (c) acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});
  const presentCategories = CATEGORY_ORDER.filter((c) => counts[c] > 0);

  const visibleEmails =
    filter === "all"
      ? emails
      : emails.filter((e) => classifications[e.id] === filter || e.id === pendingDraft?.emailId);

  return (
    <div className="space-y-3">
      {/* Working indicator — visible while the agent processes between decisions */}
      {isRunning && !pendingDraft && (
        <div className="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-3 py-2">
          <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          Processing… drafting the next reply.
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <FilterButton label={`All (${emails.length})`} active={filter === "all"} onClick={() => setFilter("all")} />
        {presentCategories.map((c) => (
          <FilterButton
            key={c}
            label={`${c} (${counts[c]})`}
            active={filter === c}
            onClick={() => setFilter(c)}
            chipClass={CHIP_STYLE[c]}
          />
        ))}
      </div>

      {/* Email list */}
      <div className="space-y-2">
        {visibleEmails.map((email) => {
          const category = classifications[email.id];
          const decision = decisionMap[email.id];
          const isPending = pendingDraft?.emailId === email.id;
          const isExpanded = expandedId === email.id;

          const hasOnDemandDraft = onDemandDrafts[email.id] !== undefined;
          // Show the manual button on every email, except the one the graph is
          // currently paused on, or one already showing a generated draft.
          const showGenerateButton = Boolean(onGenerateDraft) && !isPending && !hasOnDemandDraft;
          const alreadyActioned = decision?.action === "sent" || decision?.action === "edited";

          return (
            <div key={email.id} className="space-y-2">
              <div
                onClick={() => setExpandedId(isExpanded ? null : email.id)}
                className={`w-full cursor-pointer flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  isPending
                    ? "border-indigo-500/60 bg-gray-900"
                    : "border-gray-800 bg-gray-900/50 hover:border-gray-700"
                }`}
              >
                <span className={`mt-1 text-gray-600 transition-transform ${isExpanded ? "rotate-90" : ""}`}>›</span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{email.from}</p>
                  <p className="text-xs text-gray-400 truncate">{email.subject}</p>
                  {!isExpanded && <p className="text-xs text-gray-600 truncate mt-0.5">{email.snippet}</p>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {decision && <span className="text-xs text-gray-500">{DECISION_LABEL[decision.action]}</span>}
                  {category && !decision && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CHIP_STYLE[category]}`}>
                      {category}
                    </span>
                  )}
                  {isPending && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 animate-pulse">
                      waiting
                    </span>
                  )}
                  {showGenerateButton && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onGenerateDraft!(email); }}
                      disabled={generatingId === email.id}
                      className="text-xs px-2.5 py-1 rounded-lg border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {generatingId === email.id ? "Generating…" : alreadyActioned ? "Reply again" : "Generate reply"}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="ml-4 rounded-lg border border-gray-800 bg-gray-900/30 px-4 py-3 space-y-2">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span><span className="text-gray-600">From:</span> {email.from}</span>
                    <span><span className="text-gray-600">Subject:</span> {email.subject}</span>
                    {category && <span><span className="text-gray-600">Category:</span> {category}</span>}
                    {decision && <span><span className="text-gray-600">Action:</span> {DECISION_LABEL[decision.action]}</span>}
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans leading-relaxed max-h-72 overflow-y-auto">
                    {email.body || email.snippet}
                  </pre>
                </div>
              )}

              {/* Active draft awaiting your decision (from the graph run) */}
              {isPending && pendingDraft && (
                <div className="ml-4" ref={cardRef}>
                  <DraftCard
                    key={pendingDraft.emailId}
                    emailFrom={pendingDraft.emailFrom}
                    emailSubject={pendingDraft.emailSubject}
                    draft={pendingDraft.draft}
                    onDecision={onDecision}
                    isLoading={isRunning}
                  />
                </div>
              )}

              {/* On-demand draft for any email (manually generated) */}
              {!isPending && hasOnDemandDraft && (
                <div className="ml-4">
                  <DraftCard
                    key={`ondemand-${email.id}`}
                    emailFrom={email.from}
                    emailSubject={email.subject}
                    draft={onDemandDrafts[email.id]}
                    onDecision={(d) => onDemandDecision?.(email, d)}
                    isLoading={generatingId === email.id}
                  />
                </div>
              )}
            </div>
          );
        })}

        {visibleEmails.length === 0 && (
          <p className="text-sm text-gray-600 text-center py-6">No emails in this category.</p>
        )}
      </div>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
  chipClass,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  chipClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full font-medium capitalize transition-colors border ${
        active
          ? "border-indigo-500 bg-indigo-500/15 text-white"
          : `border-gray-800 text-gray-400 hover:border-gray-600 ${chipClass ?? ""}`
      }`}
    >
      {label}
    </button>
  );
}
