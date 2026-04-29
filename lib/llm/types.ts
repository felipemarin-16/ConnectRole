export type JsonChatInput = {
  systemPrompt: string;
  userPrompt: string;
};

export interface LlmProvider {
  readonly providerName: "ollama" | "hosted" | "groq";
  generateJson<T>(input: JsonChatInput): Promise<T>;
}

