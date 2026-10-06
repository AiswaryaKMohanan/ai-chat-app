// Anthropic first-party API list prices in USD per million tokens (as of
// 2026-09). Update when prices change or a new model is used.
const PRICES_PER_MILLION: Record<string, { input: number; output: number }> = {
  'claude-fable-5-1': { input: 10, output: 50 },
  'claude-fable-5': { input: 10, output: 50 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

// Longest id first so `claude-opus-5-5` is not priced as `claude-opus-5`
const MODEL_IDS = Object.keys(PRICES_PER_MILLION).sort((a, b) => b.length - a.length);

// Returns undefined for a model with no known price, so the UI shows no cost
// rather than a wrong one.
export function estimateCostUsd(
  model: string,
  inputTokens: number | undefined,
  outputTokens: number | undefined
): number | undefined {
  // Also match date-suffixed ids such as `claude-haiku-4-5-20251001`
  const id = MODEL_IDS.find((key) => model === key || model.startsWith(`${key}-`));
  if (!id || inputTokens === undefined || outputTokens === undefined) return undefined;

  const price = PRICES_PER_MILLION[id];
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
