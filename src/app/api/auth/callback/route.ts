import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/?error=oauth_denied", req.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

  // Exchange the authorization code for access + refresh tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error("Token exchange failed:", body);
    return NextResponse.redirect(new URL("/?error=token_exchange", req.url));
  }

  const tokens = await tokenRes.json();

  const session = await getSession();
  session.googleTokens = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: Date.now() + tokens.expires_in * 1000,
  };
  await session.save();

  // AI is normally connected before Gmail (hub flow); go straight to the inbox.
  // Fall back to /setup only if no LLM is configured yet.
  const dest = session.llmConfig ? "/inbox" : "/setup";
  return NextResponse.redirect(new URL(dest, req.url));
}
