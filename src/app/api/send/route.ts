import { NextRequest, NextResponse } from "next/server";
import { sendReply } from "@/lib/gmail";
import { getSession } from "@/lib/session";

// On-demand send for a single reply (used after re-drafting a skipped email),
// independent of the graph run. No-op in demo / when Gmail isn't connected.
export async function POST(req: NextRequest) {
  const session = await getSession();

  let payload: { to: string; subject: string; body: string; threadId?: string; messageId?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!payload?.to || !payload?.body) {
    return NextResponse.json({ error: "to and body are required" }, { status: 400 });
  }

  // Demo or not connected → logged no-op, mirrors the graph's send node.
  if (session.demoMode || !session.googleTokens) {
    return NextResponse.json({ ok: true, sent: false });
  }

  try {
    const subject = payload.subject.startsWith("Re:") ? payload.subject : `Re: ${payload.subject}`;
    await sendReply(session.googleTokens, payload.to, subject, payload.body, {
      threadId: payload.threadId,
      inReplyTo: payload.messageId,
    });
    return NextResponse.json({ ok: true, sent: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 502 }
    );
  }
}
