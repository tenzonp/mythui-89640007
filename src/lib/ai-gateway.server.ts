import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

/**
 * Lovable AI Gateway provider (kept for fallback / image generation).
 */
export function createLovableAiGatewayProvider(lovableApiKey: string, initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let runIdResolved = false;
  const runIdReady = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });
  const publishRunId = (value?: string) => {
    const next = value?.trim() || undefined;
    if (!runId && next) runId = next;
    if (!runIdResolved) {
      runIdResolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publishRunId(runId);

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      try {
        const response = await fetch(input, { ...init, headers });
        publishRunId(response.headers.get(LOVABLE_AIG_RUN_ID_HEADER) ?? undefined);
        return response;
      } catch (e) {
        publishRunId(undefined);
        throw e;
      }
    },
  });

  return Object.assign(provider, {
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : runIdReady),
  });
}

/**
 * DeepSeek provider (OpenAI-compatible API).
 * Available models:
 *  - "deepseek-chat"     → DeepSeek-V3 (general purpose, default)
 *  - "deepseek-reasoner" → DeepSeek-R1 (extended reasoning)
 */
export function createDeepSeekProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "deepseek",
    baseURL: "https://api.deepseek.com/v1",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

// DeepSeek V4 model IDs (official, as of 2026-04).
//   deepseek-v4-pro   → flagship 1.6T MoE, top reasoning + 1M context
//   deepseek-v4-flash → 284B MoE, fast/cheap for simple turns
export const DEEPSEEK_PRO_MODEL = "deepseek-v4-pro";
export const DEEPSEEK_FLASH_MODEL = "deepseek-v4-flash";

// Back-compat aliases used elsewhere in the codebase.
export const DEEPSEEK_CHAT_MODEL = DEEPSEEK_PRO_MODEL;
export const DEEPSEEK_REASONER_MODEL = DEEPSEEK_PRO_MODEL;

// Default to V4 Pro for both the CEO chat and delegated specialists.
export const DEEPSEEK_MAIN_MODEL = DEEPSEEK_PRO_MODEL;
export const DEEPSEEK_SUB_MODEL = DEEPSEEK_PRO_MODEL;

/**
 * Auto-pick a DeepSeek V4 model based on task signals.
 * - Delegated work, long prompts, complex reasoning, many tools → V4 Pro
 * - Short, simple conversational turns → V4 Flash
 */
export function pickDeepSeekModel(opts: {
  taskText?: string;
  isDelegated?: boolean;
  toolCount?: number;
}): string {
  if (opts.isDelegated) return DEEPSEEK_PRO_MODEL;
  const text = opts.taskText ?? "";
  const long = text.length > 800;
  const complex = /\b(analy[sz]e|reason|plan|debug|architect|strategy|compare|evaluate|why|step[- ]by[- ]step)\b/i.test(
    text,
  );
  const manyTools = (opts.toolCount ?? 0) >= 8;
  return long || complex || manyTools ? DEEPSEEK_PRO_MODEL : DEEPSEEK_FLASH_MODEL;
}

