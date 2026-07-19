import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import type { LLMConfig } from "@/lib/llm";

export type GoogleTokens = {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
};

export type SessionData = {
  googleTokens?: GoogleTokens;
  llmConfig?: LLMConfig;
  threadId?: string;
  demoMode?: boolean;
  fetchMode?: "incremental" | "backfill";
};

const sessionOptions = {
  password: process.env.SESSION_SECRET ?? "dev-secret-change-in-production-32ch",
  cookieName: "openmail_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
