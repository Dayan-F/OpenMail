export type Category = "reply" | "fyi" | "newsletter" | "spam" | "job";

export type EmailMeta = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  body: string;
  threadId?: string;    // Gmail thread id — needed to reply in-thread
  messageId?: string;   // RFC Message-ID header — needed for In-Reply-To/References
};

export type Decision = {
  id: string;
  action: "sent" | "edited" | "skipped" | "archived" | "flagged";
  at: string;
};

// The stages an application email can represent, in rough chronological order.
export type ApplicationStage =
  | "applied"      // application submitted / acknowledged
  | "interview"    // an interview round (phone, onsite…)
  | "assessment"   // technical test / take-home / coding challenge
  | "offer"        // offer extended / accepted
  | "rejected"     // rejection
  | "update";      // generic status update / other

export type ApplicationEvent = {
  id: string;
  stage: ApplicationStage;
  label: string;        // display label, e.g. "Interview 2", "Technical test"
  summary: string | null;
  at: string;           // ISO date
  emailId: string | null;
  emailFrom: string | null;      // stored so a step can show its source email
  emailSubject: string | null;
  emailBody: string | null;
};

export type Application = {
  id: string;
  company: string;
  role: string | null;
  appliedAt: string;
  events: ApplicationEvent[];   // the timeline, oldest → newest
};

export type FetchWindow =
  | { mode: "backfill"; after: string; before: string }
  | { mode: "incremental" };

export type RangePreset = "7d" | "30d" | "90d" | "custom";
