import { NextRequest, NextResponse } from "next/server";
import { addApplicationEvent, deleteApplicationEvent, initDb } from "@/lib/db";
import type { ApplicationStage } from "@/lib/types";

const STAGES: ApplicationStage[] = ["applied", "interview", "assessment", "offer", "rejected", "update"];

// Manually add a timeline event to an application.
export async function POST(req: NextRequest) {
  await initDb();
  const { applicationId, stage, summary } = await req.json();
  if (!applicationId || !stage) {
    return NextResponse.json({ error: "applicationId and stage are required" }, { status: 400 });
  }
  if (!STAGES.includes(stage)) {
    return NextResponse.json({ error: "invalid stage" }, { status: 400 });
  }
  await addApplicationEvent(applicationId, stage, summary ?? null);
  return NextResponse.json({ ok: true });
}

// Remove a single timeline event.
export async function DELETE(req: NextRequest) {
  await initDb();
  const { eventId } = await req.json();
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }
  await deleteApplicationEvent(eventId);
  return NextResponse.json({ ok: true });
}
