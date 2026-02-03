import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiFeature } from '@/types/analytics';

interface AiUsageParams {
  projectId: string;
  userId: string;
  feature: AiFeature;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Log AI usage to the ai_usage_log table.
 * Call this after every OpenRouter API call to track token consumption.
 */
export async function logAiUsage(
  supabase: SupabaseClient,
  params: AiUsageParams
): Promise<void> {
  try {
    const { error } = await supabase.from('ai_usage_log').insert({
      project_id: params.projectId,
      user_id: params.userId,
      feature: params.feature,
      model: params.model,
      prompt_tokens: params.promptTokens ?? null,
      completion_tokens: params.completionTokens ?? null,
      total_tokens: params.totalTokens ?? null,
      metadata: params.metadata ?? {},
    });

    if (error) {
      console.error('Failed to log AI usage:', error);
    }
  } catch (err) {
    // Don't let usage logging failures break the main flow
    console.error('Error logging AI usage:', err);
  }
}

/**
 * Get OpenRouter account key info (balance, credits remaining).
 * Calls GET https://openrouter.ai/api/v1/auth/key
 */
export async function getOpenRouterKeyInfo(): Promise<{
  label: string;
  usage: number;
  limit: number | null;
  is_free_tier: boolean;
  rate_limit: { requests: number; interval: string } | null;
} | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data?.data ?? null;
  } catch {
    return null;
  }
}
