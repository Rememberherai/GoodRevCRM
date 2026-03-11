import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmailSignature } from '@/types/sequence';

/**
 * Fetch the default email signature for a user in a project.
 * Returns null if no default signature is set.
 */
export async function getDefaultSignature(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<EmailSignature | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('email_signatures')
    .select('*')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) {
    console.error('[SIGNATURES] Error fetching default signature:', error.message);
    return null;
  }

  return data as EmailSignature | null;
}

/**
 * Append a signature to HTML email body.
 * Inserts before any quoted reply block if present.
 */
export function appendSignatureToHtml(bodyHtml: string, signatureHtml: string): string {
  const signatureBlock = `<div class="email-signature" style="margin-top:20px;padding-top:10px;border-top:1px solid #ccc">${signatureHtml}</div>`;

  // Insert before quoted reply block if present
  const quoteIndex = bodyHtml.indexOf('<div class="gmail_quote"');
  if (quoteIndex !== -1) {
    return bodyHtml.slice(0, quoteIndex) + signatureBlock + bodyHtml.slice(quoteIndex);
  }

  return bodyHtml + signatureBlock;
}
