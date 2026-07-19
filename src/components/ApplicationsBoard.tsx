"use client";

import { useState } from "react";
import type { Application, ApplicationStage, ApplicationEvent } from "@/lib/types";

type Props = {
  applications: Application[];
  onAdd: (company: string, role: string) => void;
  onDelete?: (id: string) => void;
  onAddEvent?: (applicationId: string, stage: ApplicationStage) => void;
  onDeleteEvent?: (eventId: string) => void;
};

const STAGE_META: Record<ApplicationStage, { dot: string; text: string; ring: string }> = {
  applied:    { dot: "bg-gray-400",   text: "text-gray-300",   ring: "ring-gray-400/30" },
  interview:  { dot: "bg-blue-400",   text: "text-blue-300",   ring: "ring-blue-400/30" },
  assessment: { dot: "bg-purple-400", text: "text-purple-300", ring: "ring-purple-400/30" },
  offer:      { dot: "bg-green-400",  text: "text-green-300",  ring: "ring-green-400/30" },
  rejected:   { dot: "bg-red-400",    text: "text-red-300",    ring: "ring-red-400/30" },
  update:     { dot: "bg-gray-500",   text: "text-gray-400",   ring: "ring-gray-500/30" },
};

const ADD_STAGES: { stage: ApplicationStage; label: string }[] = [
  { stage: "interview", label: "+ Interview" },
  { stage: "assessment", label: "+ Technical test" },
  { stage: "offer", label: "+ Offer" },
  { stage: "rejected", label: "+ Rejected" },
  { stage: "update", label: "+ Update" },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function statusBadge(app: Application): { label: string; cls: string } {
  const last = app.events[app.events.length - 1];
  if (!last) return { label: "No events", cls: "bg-gray-500/15 text-gray-400" };
  if (last.stage === "offer") return { label: "Offer 🎉", cls: "bg-green-500/15 text-green-300" };
  if (last.stage === "rejected") return { label: "Rejected", cls: "bg-red-500/15 text-red-300" };
  return { label: "In progress", cls: "bg-indigo-500/15 text-indigo-300" };
}

function Timeline({
  app,
  selectedId,
  onSelect,
}: {
  app: Application;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (app.events.length === 0) {
    return <p className="text-xs text-gray-600">No events yet.</p>;
  }
  return (
    // py-3 gives the dot rings room so overflow-x doesn't clip them vertically
    <div className="flex overflow-x-auto py-3">
      {app.events.map((ev, i) => {
        const meta = STAGE_META[ev.stage];
        const isSel = selectedId === ev.id;
        return (
          <button
            key={ev.id}
            onClick={() => onSelect(ev.id)}
            className="flex flex-col items-center min-w-[88px] px-1 shrink-0 focus:outline-none"
          >
            {/* dot row with connector to previous dot */}
            <div className="relative flex items-center justify-center w-full h-4">
              {i > 0 && (
                <span className="absolute top-1/2 right-1/2 -translate-y-1/2 w-full h-px bg-gray-700" />
              )}
              <span
                className={`relative z-10 w-3 h-3 rounded-full ${meta.dot} transition-all ${
                  isSel ? `ring-4 ${meta.ring}` : ""
                }`}
              />
            </div>
            <span className={`text-[11px] font-medium mt-1.5 text-center ${meta.text}`}>{ev.label}</span>
            <span className="text-[10px] text-gray-600">{fmtDate(ev.at)}</span>
          </button>
        );
      })}
    </div>
  );
}

function EventDetail({
  event,
  onClose,
  onDelete,
}: {
  event: ApplicationEvent;
  onClose: () => void;
  onDelete?: (eventId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2.5 space-y-1.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-200">{event.label} · {fmtDate(event.at)}</span>
        <div className="flex items-center gap-3">
          {onDelete && (
            <button onClick={() => onDelete(event.id)} className="text-gray-600 hover:text-red-400">remove</button>
          )}
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300">close</button>
        </div>
      </div>
      {event.emailSubject && (
        <p className="text-gray-400">
          <span className="text-gray-600">{event.emailFrom}</span> — {event.emailSubject}
        </p>
      )}
      {event.emailBody ? (
        <pre className="whitespace-pre-wrap text-gray-400 max-h-56 overflow-y-auto font-sans leading-relaxed">
          {event.emailBody}
        </pre>
      ) : event.summary ? (
        <p className="text-gray-500">{event.summary}</p>
      ) : (
        <p className="text-gray-600 italic">No email attached — added manually.</p>
      )}
    </div>
  );
}

function AppCard({
  app,
  onDelete,
  onAddEvent,
  onDeleteEvent,
}: {
  app: Application;
  onDelete?: (id: string) => void;
  onAddEvent?: (applicationId: string, stage: ApplicationStage) => void;
  onDeleteEvent?: (eventId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const badge = statusBadge(app);
  const selectedEvent = app.events.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="group relative rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{app.company}</p>
          {app.role && <p className="text-xs text-gray-400 truncate">{app.role}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
          {onDelete && (
            <button
              onClick={() => onDelete(app.id)}
              title="Delete application"
              className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <Timeline
        app={app}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
      />

      {selectedEvent && (
        <EventDetail event={selectedEvent} onClose={() => setSelectedId(null)} onDelete={onDeleteEvent} />
      )}

      {onAddEvent && (
        adding ? (
          <div className="flex flex-wrap gap-1.5">
            {ADD_STAGES.map((s) => (
              <button
                key={s.stage}
                onClick={() => { onAddEvent(app.id, s.stage); setAdding(false); }}
                className="text-[11px] px-2 py-0.5 rounded border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
              >
                {s.label}
              </button>
            ))}
            <button onClick={() => setAdding(false)} className="text-[11px] px-2 py-0.5 text-gray-500 hover:text-gray-300">
              cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="text-[11px] text-indigo-300/80 hover:text-indigo-200 transition-colors"
          >
            + add stage
          </button>
        )
      )}
    </div>
  );
}

export function ApplicationsBoard({ applications, onAdd, onDelete, onAddEvent, onDeleteEvent }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");

  function handleAdd() {
    if (!company.trim()) return;
    onAdd(company.trim(), role.trim());
    setCompany("");
    setRole("");
    setShowForm(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-500">
          {applications.length} application{applications.length !== 1 ? "s" : ""} tracked
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
        >
          + Add application
        </button>
      </div>

      {showForm && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Company</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Corp"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Role (optional)</label>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Frontend Engineer"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            onClick={handleAdd}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors"
          >
            Add
          </button>
        </div>
      )}

      {applications.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-10">
          No applications yet. Add one, or run the agent — job emails build their own timelines.
        </p>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              onDelete={onDelete}
              onAddEvent={onAddEvent}
              onDeleteEvent={onDeleteEvent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
