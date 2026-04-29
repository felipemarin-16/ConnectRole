import { GroqProvider } from "@/lib/llm/groq-provider";
import { HostedProvider } from "@/lib/llm/hosted-provider";
import { OllamaProvider } from "@/lib/llm/ollama-provider";
import type { LlmProvider } from "@/lib/llm/types";

export function getLlmProvider(): LlmProvider {
  const mode = (process.env.INTERVIEW_LLM_PROVIDER || "groq").toLowerCase();

  if (mode === "hosted") {
    return new HostedProvider();
  }

  if (mode === "ollama") {
    return new OllamaProvider();
  }

  return new GroqProvider();
}

