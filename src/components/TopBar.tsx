"use client";

import { useState } from "react";
import type { RangePreset, FetchWindow } from "@/lib/types";
import { windowFromPreset } from "@/lib/window";

const PRESETS: RangePreset[] = ["7d", "30d", "90d", "custom"];
const PRESET_LABEL: Record<RangePreset, string> = {
  "7d": "7 days", "30d": "30 days", "90d": "90 days", custom: "Custom",
};

type Props = {
  isRunning: boolean;
  checkedAt: string | null;
  onRun: (window: FetchWindow) => void;
  demoMode?: boolean;
};

export function TopBar({ isRunning, checkedAt, onRun, demoMode }: Props) {
  const [preset, setPreset] = useState<RangePreset>("7d");
  const [customAfter, setCustomAfter] = useState("");
  const [customBefore, setCustomBefore] = useState("");

  function handleRun() {
    const window = windowFromPreset(
      preset,
      preset === "custom" ? { after: customAfter, before: customBefore } : undefined
    );
    onRun(window);
  }

  const elapsed = checkedAt
    ? Math.round((Date.now() - new Date(checkedAt).getTime()) / 60_000)
    : null;

  return (
    <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-gray-800">
      {demoMode && (
        <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
          Demo mode
        </span>
      )}

      <div className="flex rounded-lg border border-gray-700 overflow-hidden text-xs">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`px-3 py-1.5 transition-colors ${
              preset === p ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {PRESET_LABEL[p]}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex gap-2 items-center text-xs">
          <input
            type="date"
            value={customAfter}
            onChange={(e) => setCustomAfter(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none"
          />
          <span className="text-gray-600">→</span>
          <input
            type="date"
            value={customBefore}
            onChange={(e) => setCustomBefore(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none"
          />
        </div>
      )}

      <button
        onClick={handleRun}
        disabled={isRunning}
        className="ml-auto px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium transition-colors"
      >
        {isRunning ? "Running…" : "Run now"}
      </button>

      {elapsed !== null && (
        <span className="text-xs text-gray-600">
          Checked {elapsed === 0 ? "just now" : `${elapsed}m ago`}
        </span>
      )}
    </div>
  );
}
