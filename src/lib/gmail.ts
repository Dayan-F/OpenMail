import type { GoogleTokens } from "@/lib/session";
import type { EmailMeta } from "@/lib/types";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function refreshIfNeeded(tokens: GoogleTokens): Promise<GoogleTokens> {
  if (Date.now() < tokens.expiry_date - 60_000) return tokens;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error("Failed to refresh Google access token");

  const data = await res.json();
  return {
    ...tokens,
    access_token: data.access_token,
    expiry_date: Date.now() + data.expires_in * 1000,
  };
}

async function gmailFetch(
  tokens: GoogleTokens,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const fresh = await refreshIfNeeded(tokens);
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${fresh.access_token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

function decodeBody(payload: Record<string, unknown>): string {
  const part = payload as {
    mimeType?: string;
    body?: { data?: string };
    parts?: unknown[];
  };

  if (part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf-8");
  }

  if (Array.isArray(part.parts)) {
    for (const p of part.parts) {
      const text = decodeBody(p as Record<string, unknown>);
      if (text) return text;
    }
  }

  return "";
}

export async function searchEmails(
  tokens: GoogleTokens,
  query: string,
  maxResults = 50
): Promise<EmailMeta[]> {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  const listRes = await gmailFetch(tokens, `/messages?${params}`);
  if (!listRes.ok) throw new Error("Gmail search failed");

  const { messages = [] } = await listRes.json();

  const emails: EmailMeta[] = await Promise.all(
    (messages as { id: string }[]).map(async ({ id }) => {
      const msgRes = await gmailFetch(tokens, `/messages/${id}?format=full`);
      if (!msgRes.ok) throw new Error(`Failed to fetch message ${id}`);
      const msg = await msgRes.json();

      const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
      const get = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

      return {
        id,
        from: get("From"),
        subject: get("Subject"),
        snippet: msg.snippet ?? "",
        body: decodeBody(msg.payload ?? {}),
        threadId: msg.threadId,
        messageId: get("Message-ID"),
      };
    })
  );

  return emails;
}

// RFC 2047 encoded-word so non-ASCII subjects (accents, emoji) are valid in a header.
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

export async function sendReply(
  tokens: GoogleTokens,
  to: string,
  subject: string,
  body: string,
  opts: { threadId?: string; inReplyTo?: string } = {}
): Promise<void> {
  const headers = [
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
  ];
  if (opts.inReplyTo) {
    headers.push(`In-Reply-To: ${opts.inReplyTo}`);
    headers.push(`References: ${opts.inReplyTo}`);
  }

  // Buffer handles UTF-8 correctly (btoa would throw on non-Latin1 chars); base64url per Gmail.
  const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`, "utf-8").toString("base64url");

  const payload: { raw: string; threadId?: string } = { raw };
  if (opts.threadId) payload.threadId = opts.threadId;

  const res = await gmailFetch(tokens, "/messages/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Failed to send reply${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
}

export async function archiveMessage(tokens: GoogleTokens, messageId: string): Promise<void> {
  const res = await gmailFetch(tokens, `/messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
  });

  if (!res.ok) throw new Error("Failed to archive message");
}
