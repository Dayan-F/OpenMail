import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";

export type LLMConfig =
  | { provider: "groq"; apiKey: string; model: string }
  | { provider: "ollama"; baseUrl: string; model: string };

export type ChatModel = ChatGroq | ChatOpenAI;

export function makeModel(cfg: LLMConfig): ChatModel {
  if (cfg.provider === "groq") {
    return new ChatGroq({ apiKey: cfg.apiKey, model: cfg.model });
  }

  // Ollama speaks the OpenAI-compatible API — same client, different base URL.
  // apiKey must be a non-empty string; Ollama ignores its value.
  return new ChatOpenAI({
    model: cfg.model,
    apiKey: "ollama",
    configuration: { baseURL: cfg.baseUrl },
  });
}
