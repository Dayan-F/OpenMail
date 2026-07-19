import type { TriageStateType } from "@/graph/state";

export function nextEmail(state: TriageStateType): Partial<TriageStateType> {
  return { cursor: state.cursor + 1 };
}
