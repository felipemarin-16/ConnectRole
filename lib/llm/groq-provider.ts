import { extractJsonObject } from "@/lib/llm/json";
import type { JsonChatInput, LlmProvider } from "@/lib/llm/types";

type GroqMessage = {
  role: "system" | "user";
  content: string;
};

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export class GroqProvider implements LlmProvider {
  readonly providerName = "groq" as const;

  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly fallbackModel: string;

  constructor() {
    this.apiKey = process.env.GROQ_API_KEY?.trim() || "";
    this.defaultModel = process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
    this.fallbackModel = "llama-3.1-8b-instant";
  }

  async generateJson<T>({ systemPrompt, userPrompt }: JsonChatInput): Promise<T> {
    if (!this.apiKey) {
      throw new Error("GROQ_API_KEY is not configured.");
    }

    try {
      return await this.makeRequest<T>(this.defaultModel, systemPrompt, userPrompt);
    } catch (error) {
      // If the default model fails (e.g., rate limit), try the fallback model
      if (this.defaultModel !== this.fallbackModel) {
        console.warn(`Groq request failed with ${this.defaultModel}, retrying with ${this.fallbackModel}...`, error);
        return await this.makeRequest<T>(this.fallbackModel, systemPrompt, userPrompt);
      }
      throw error;
    }
  }

  private async makeRequest<T>(model: string, systemPrompt: string, userPrompt: string): Promise<T> {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        response_format: { type: "json_object" },
        temperature: 0.6,
        messages: [
          { role: "system", content: systemPrompt } satisfies GroqMessage,
          { role: "user", content: userPrompt } satisfies GroqMessage,
        ],
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Groq request failed (${response.status}): ${details || "No details provided."}`);
    }

    const payload = (await response.json()) as GroqChatResponse;
    const content = payload.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("Groq response did not contain message content.");
    }

    return extractJsonObject(content) as T;
  }
}
