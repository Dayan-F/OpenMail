import Link from "next/link";
import { getSession } from "@/lib/session";

export default async function LandingPage() {
  const session = await getSession();
  const cfg = session.llmConfig;
  const providerLabel = cfg
    ? cfg.provider === "groq"
      ? `Groq · ${cfg.model}`
      : `Ollama · ${cfg.model}`
    : null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center max-w-xl">
        <h1 className="text-4xl font-bold tracking-tight mb-3">OpenMail</h1>
        <p className="text-gray-400 text-lg">
          Agentic inbox triage and job application tracker — human-in-the-loop by design.
        </p>
      </div>

      {!cfg ? (
        /* ── Step 1: no AI connected yet ── */
        <div className="flex flex-col items-center gap-4">
          <p className="text-gray-400 text-sm text-center max-w-sm">
            First, connect an AI provider. It powers email classification and reply drafting —
            everything else is built on top of it.
          </p>
          <Link
            href="/setup"
            className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium transition-colors"
          >
            Connect your AI
          </Link>
          <p className="text-gray-600 text-xs">Groq (hosted) or Ollama (fully local)</p>
        </div>
      ) : (
        /* ── Step 2: AI connected → choose a path ── */
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <div className="flex items-center gap-3 text-sm bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2">
            <span className="text-green-400">AI connected</span>
            <span className="text-gray-500">·</span>
            <span className="text-gray-300">{providerLabel}</span>
            <Link href="/setup" className="text-gray-500 hover:text-gray-300 underline underline-offset-2 ml-1">
              change
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <Link
              href="/demo"
              className="flex-1 px-6 py-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium transition-colors text-center"
            >
              Try the demo
              <span className="block text-xs font-normal text-indigo-200/80 mt-0.5">mock inbox, no Gmail</span>
            </Link>
            <a
              href="/api/auth/google"
              className="flex-1 px-6 py-4 rounded-lg border border-gray-700 hover:border-gray-500 font-medium transition-colors text-center"
            >
              Connect Gmail
              <span className="block text-xs font-normal text-gray-500 mt-0.5">your real inbox</span>
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
