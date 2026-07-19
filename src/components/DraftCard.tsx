"use client";

import { useState } from "react";

type Decision =
  | { action: "approve" }
  | { action: "edit"; editedBody: string }
  | { action: "skip" };

type Props = {
  emailFrom: string;
  emailSubject: string;
  draft: string;
  onDecision: (d: Decision) => void;
  isLoading: boolean;
};

export function DraftCard({ emailFrom, emailSubject, draft, onDecision, isLoading }: Props) {
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(draft);

  return (
    <div className="rounded-xl border border-indigo-500/40 bg-gray-900 p-4 space-y-4">
      <div>
        <p className="text-xs text-gray-500 mb-0.5">Replying to</p>
        <p className="text-sm font-medium truncate">{emailFrom}</p>
        <p className="text-xs text-gray-400 truncate">{emailSubject}</p>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-2">Draft</p>
        {editing ? (
          <textarea
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            rows={8}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-500"
          />
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-gray-200 bg-gray-800 rounded-lg px-3 py-2 font-sans leading-relaxed">
            {draft}
          </pre>
        )}
      </div>

      <div className="flex gap-2">
        {editing ? (
          <>
            <button
              onClick={() => { onDecision({ action: "edit", editedBody }); setEditing(false); }}
              disabled={isLoading}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {isLoading ? "Sending…" : "Send edited"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-lg border border-gray-700 text-sm transition-colors hover:border-gray-500"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onDecision({ action: "approve" })}
              disabled={isLoading}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {isLoading ? "Sending…" : "Approve & send"}
            </button>
            <button
              onClick={() => setEditing(true)}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-500 text-sm transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => onDecision({ action: "skip" })}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-500 text-sm text-gray-400 transition-colors"
            >
              Skip
            </button>
          </>
        )}
      </div>
    </div>
  );
}
