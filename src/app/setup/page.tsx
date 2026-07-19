"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GROQ_MODELS } from "@/lib/models";

type Provider = "groq" | "ollama";

export default function SetupPage() {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider>("groq");
  const [groqKey, setGroqKey] = useState("");
  const [groqModel, setGroqModel] = useState<string>(GROQ_MODELS[0]);
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434/v1");
  const [ollamaModel, setOllamaModel] = useState("llama3");
  const [status, setStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleTest() {
    setStatus("testing");
    setErrorMsg("");

    const body =
      provider === "groq"
        ? { provider, apiKey: groqKey, model: groqModel }
        : { provider, baseUrl: ollamaUrl, model: ollamaModel };

    const res = await fetch("/api/setup/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setStatus("ok");
      setTimeout(() => router.push("/"), 800);
    } else {
      const { error } = await res.json();
      setErrorMsg(error ?? "Unknown error");
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div>
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            ← Back
          </Link>
          <p className="text-xs uppercase tracking-wider text-indigo-400 mt-3 mb-1">Step 1 of 2</p>
          <h1 className="text-2xl font-bold">Connect your AI</h1>
          <p className="text-gray-400 text-sm mt-1">
            Powers classification and drafting. Groq is the default (fast, free tier). Ollama runs
            fully local — no data leaves your machine.
          </p>
        </div>

        {/* Provider toggle */}
        <div className="flex rounded-lg border border-gray-700 overflow-hidden">
          {(["groq", "ollama"] as Provider[]).map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                provider === p ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {p === "groq" ? "Groq (hosted)" : "Ollama (local)"}
            </button>
          ))}
        </div>

        {/* Groq fields */}
        {provider === "groq" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">API Key</label>
              <input
                type="password"
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder="gsk_..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Model</label>
              <select
                value={groqModel}
                onChange={(e) => setGroqModel(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                {GROQ_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Ollama fields */}
        {provider === "ollama" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Base URL</label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Model name</label>
              <input
                type="text"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                placeholder="llama3, mistral, phi3..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Test button */}
        <button
          onClick={handleTest}
          disabled={status === "testing" || status === "ok"}
          className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium text-sm transition-colors"
        >
          {status === "testing" ? "Testing…" : status === "ok" ? "Connected ✓" : "Test connection"}
        </button>

        {status === "error" && (
          <p className="text-red-400 text-sm text-center">{errorMsg}</p>
        )}
      </div>
    </main>
  );
}
