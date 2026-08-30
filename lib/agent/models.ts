export interface ModelProfile {
  id: string;
  providerId: string;
  model: string;
  displayName: string;
  kind: "codex" | "custom";
  capabilities: string[];
}

export const DEFAULT_MODELS: ModelProfile[] = [
  {
    id: "openai:gpt-5.6-terra",
    providerId: "openai",
    model: "gpt-5.6-terra",
    displayName: "Codex Terra",
    kind: "codex",
    capabilities: ["tools", "reasoning", "vision"],
  },
  {
    id: "vibehard:embedded-agent",
    providerId: "vibehard",
    model: "embedded-agent",
    displayName: "VibeHard Embedded Agent",
    kind: "custom",
    capabilities: ["tools", "hardware"],
  },
];
