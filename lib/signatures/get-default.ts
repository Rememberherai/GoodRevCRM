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
  const cleanedBodyHtml = bodyHtml.replace(
    /(\s*<p>\s*(<br\s*\/?>|&nbsp;)?\s*<\/p>\s*)+$/i,
    ''
  );
  const cleanedSignatureHtml = signatureHtml
    .replace(/^\s*(<p>\s*(<br\s*\/?>|&nbsp;)\s*<\/p>\s*)*/i, '')
    .replace(/^\s*<hr\b[^>]*>\s*/i, '');
  const signatureBlock = `<div class="email-signature"><p style="margin: 0; padding: 0; min-height: 1.5em;">&nbsp;</p>${cleanedSignatureHtml}</div>`;

  // Insert before quoted reply block if present
  const quoteIndex = cleanedBodyHtml.indexOf('<div class="gmail_quote"');
  if (quoteIndex !== -1) {
    return cleanedBodyHtml.slice(0, quoteIndex) + signatureBlock + cleanedBodyHtml.slice(quoteIndex);
  }

  return cleanedBodyHtml + signatureBlock;
}
