// Provider-agnostic LLM access for all Starling edge functions.
//
// Configure with function secrets (supabase secrets set ...):
//   LLM_API_KEY     — required. API key for an OpenAI-compatible provider.
//   LLM_BASE_URL    — optional. Defaults to Google's Gemini OpenAI-compatible
//                     endpoint. Other examples:
//                       OpenAI:    https://api.openai.com/v1
//                       Anthropic: https://api.anthropic.com/v1
//   LLM_MODEL       — optional. Default model (default: gemini-2.5-flash).
//   LLM_MODEL_LITE  — optional. Cheaper model for lightweight calls
//                     (default: gemini-2.5-flash-lite).
//
// Falls back to the legacy Lovable gateway when only LOVABLE_API_KEY is set.

const CUSTOM_KEY = Deno.env.get("LLM_API_KEY") || "";
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const USING_LOVABLE = !CUSTOM_KEY && !!LOVABLE_KEY;

const LLM_API_KEY = CUSTOM_KEY || LOVABLE_KEY;

export const LLM_BASE_URL =
  Deno.env.get("LLM_BASE_URL") ||
  (USING_LOVABLE
    ? "https://ai.gateway.lovable.dev/v1"
    : "https://generativelanguage.googleapis.com/v1beta/openai");

export const LLM_MODEL =
  Deno.env.get("LLM_MODEL") || (USING_LOVABLE ? "google/gemini-2.5-flash" : "gemini-2.5-flash");

export const LLM_MODEL_LITE =
  Deno.env.get("LLM_MODEL_LITE") ||
  (USING_LOVABLE ? "google/gemini-2.5-flash-lite" : "gemini-2.5-flash-lite");

export function assertLLMConfigured(): void {
  if (!LLM_API_KEY) {
    throw new Error(
      "LLM_API_KEY is not configured — set it with: supabase secrets set LLM_API_KEY=<key>"
    );
  }
}

// POST an OpenAI-compatible /chat/completions request. `model` defaults to
// LLM_MODEL unless the body provides one.
export function llmChat(body: Record<string, unknown>): Promise<Response> {
  assertLLMConfigured();
  return fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: LLM_MODEL, ...body }),
  });
}
