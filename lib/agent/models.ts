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
    id: "tokenadvent:gpt-5.6-sol",
    providerId: "tokenadvent",
    model: "gpt-5.6-sol",
    displayName: "GPT-5.6 Sol",
    kind: "custom",
    capabilities: ["tools", "reasoning"],
  },
];
