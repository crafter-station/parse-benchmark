import { gateway } from "@ai-sdk/gateway";

// Provider type: AI Gateway or dedicated OCR services
export type ProviderType = "ai-gateway" | "llamaparse" | "mistral-ocr" | "datalab-marker";

// Provider category for UI differentiation
export type ProviderCategory = "parser" | "vision-llm";

// Provider definitions for UI and API
export interface ProviderConfig {
  id: string;
  name: string;
  model: string; // Display name for the model version
  description: string;
  color: string;
  modelId: string; // Format: provider/model for AI Gateway, tier/mode for OCR services
  type: ProviderType;
  category: ProviderCategory;
  categoryLabel: string; // Human-readable category description
}

export const PROVIDERS: ProviderConfig[] = [
  // Specialized Document Parsers
  {
    id: "llamaparse",
    name: "LlamaParse",
    model: "cost-effective",
    description: "LlamaIndex",
    color: "#a78bfa",
    modelId: "cost-effective",
    type: "llamaparse",
    category: "parser",
    categoryLabel: "Document Parser",
  },
  {
    id: "mistral-ocr",
    name: "Mistral OCR",
    model: "mistral-ocr-latest",
    description: "Mistral",
    color: "#ff7000",
    modelId: "mistral-ocr-latest",
    type: "mistral-ocr",
    category: "parser",
    categoryLabel: "Document Parser",
  },
  {
    id: "datalab-marker",
    name: "Marker",
    model: "fast",
    description: "Datalab",
    color: "#14b8a6",
    modelId: "fast",
    type: "datalab-marker",
    category: "parser",
    categoryLabel: "Document Parser",
  },
  // Vision LLMs via AI Gateway
  {
    id: "gpt-4o",
    name: "GPT-4o",
    model: "gpt-4o-2024-11-20",
    description: "OpenAI",
    color: "#10b981",
    modelId: "openai/gpt-4o",
    type: "ai-gateway",
    category: "vision-llm",
    categoryLabel: "Vision LLM",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    model: "gpt-4o-mini-2024-07-18",
    description: "OpenAI",
    color: "#34d399",
    modelId: "openai/gpt-4o-mini",
    type: "ai-gateway",
    category: "vision-llm",
    categoryLabel: "Vision LLM",
  },
  {
    id: "claude-sonnet-4",
    name: "Claude Sonnet 4",
    model: "claude-sonnet-4-20250514",
    description: "Anthropic",
    color: "#f59e0b",
    modelId: "anthropic/claude-sonnet-4-20250514",
    type: "ai-gateway",
    category: "vision-llm",
    categoryLabel: "Vision LLM",
  },
  {
    id: "claude-haiku-35",
    name: "Claude Haiku 3.5",
    model: "claude-3-5-haiku-20241022",
    description: "Anthropic",
    color: "#fbbf24",
    modelId: "anthropic/claude-3-5-haiku-20241022",
    type: "ai-gateway",
    category: "vision-llm",
    categoryLabel: "Vision LLM",
  },
  {
    id: "gemini-2-flash",
    name: "Gemini 2.0 Flash",
    model: "gemini-2.0-flash",
    description: "Google",
    color: "#3b82f6",
    modelId: "google/gemini-2.0-flash",
    type: "ai-gateway",
    category: "vision-llm",
    categoryLabel: "Vision LLM",
  },
  {
    id: "gemini-25-pro",
    name: "Gemini 2.5 Pro",
    model: "gemini-2.5-pro",
    description: "Google",
    color: "#60a5fa",
    modelId: "google/gemini-2.5-pro",
    type: "ai-gateway",
    category: "vision-llm",
    categoryLabel: "Vision LLM",
  },
];

// Get provider config by ID (with validation)
export function getProviderConfig(providerId: string): ProviderConfig | null {
  return PROVIDERS.find((p) => p.id === providerId) ?? null;
}

// Validate provider ID
export function isValidProviderId(providerId: string): boolean {
  return PROVIDERS.some((p) => p.id === providerId);
}

// Get model instance for AI Gateway providers
export function getModel(providerId: string) {
  const config = getProviderConfig(providerId);
  if (!config) {
    throw new Error(`Invalid provider: ${providerId}`);
  }

  if (config.type !== "ai-gateway") {
    throw new Error(`Provider ${providerId} is not an AI Gateway provider`);
  }

  // AI Gateway uses format: provider/model
  // Authentication via AI_GATEWAY_API_KEY env var is automatic
  return gateway(config.modelId);
}

// Pricing per 1M tokens (approximate, for cost estimation)
export const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "claude-sonnet-4": { input: 3, output: 15 },
  "claude-haiku-35": { input: 0.8, output: 4 },
  "gemini-2-flash": { input: 0.075, output: 0.3 },
  "gemini-25-pro": { input: 1.25, output: 10 },
};

// Per-page pricing for dedicated OCR services
export const OCR_PAGE_PRICING: Record<string, number> = {
  // LlamaParse tiers
  "cost-effective": 0.003,
  "agentic": 0.01,
  "agentic-plus": 0.03,
  // Mistral OCR
  "mistral-ocr-latest": 0.001,
  // Datalab Marker modes
  "fast": 0.005,
  "balanced": 0.01,
  "accurate": 0.02,
};

export function calculateCost(
  providerId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[providerId];
  if (!pricing) return 0;
  
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

export function calculatePageCost(modelId: string, pages: number): number {
  const pricePerPage = OCR_PAGE_PRICING[modelId] ?? 0.001;
  return pages * pricePerPage;
}
