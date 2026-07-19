import { NextRequest, NextResponse } from "next/server";
import { getApplications, createApplication, deleteApplication, addApplicationEvent, initDb } from "@/lib/db";

export async function GET() {
  await initDb();
  const applications = await getApplications();
  return NextResponse.json(applications);
}

export async function POST(req: NextRequest) {
  await initDb();
  const { company, role } = await req.json();
  if (!company) {
    return NextResponse.json({ error: "company is required" }, { status: 400 });
  }
  const id = await createApplication(company, role ?? null);
  await addApplicationEvent(id, "applied", null);   // seed the timeline
  const applications = await getApplications();
  return NextResponse.json(applications.find((a) => a.id === id), { status: 201 });
}

export async function DELETE(req: NextRequest) {
  await initDb();
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  await deleteApplication(id);
  return NextResponse.json({ ok: true });
}
