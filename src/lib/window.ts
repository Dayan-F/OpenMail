import type { FetchWindow, RangePreset } from "@/lib/types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function windowFromPreset(
  preset: RangePreset,
  custom?: { after: string; before: string }
): FetchWindow {
  if (preset === "custom" && custom) {
    return { mode: "backfill", after: custom.after, before: custom.before };
  }
  const days = { "7d": 7, "30d": 30, "90d": 90 }[preset as Exclude<RangePreset, "custom">] ?? 7;
  const after = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  return { mode: "backfill", after, before: today() };
}
