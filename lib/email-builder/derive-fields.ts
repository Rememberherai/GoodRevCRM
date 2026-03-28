import { emailDesignSchema } from '@/lib/email-builder/schema';
import { renderDesignToHtml } from '@/lib/email-builder/render-html';
import { renderDesignToText } from '@/lib/email-builder/render-text';
import { validateDesign, hasBlockingErrors } from '@/lib/email-builder/validation';

/**
 * Result of attempting to derive fields from design_json.
 *
 * - `designJson == null` → `{ status: 'skipped' }` — legacy path, caller uses body_html as-is.
 * - Valid design → `{ status: 'ok', fields: { body_html, body|body_text } }`.
 * - Invalid design → `{ status: 'invalid', error }` — caller should return 400.
 */
export type DeriveResult =
  | { status: 'skipped' }
  | { status: 'ok'; fields: Record<string, string> }
  | { status: 'invalid'; error: string };

/**
 * When `design_json` is present and valid, derive `body_html` and plain text
 * from the design.
 *
 * - Broadcasts use `body` for the plain-text field.
 * - Templates and sequence steps use `body_text`.
 *
 * If `design_json` is null/undefined (legacy path), returns `{ status: 'skipped' }`.
 * If `design_json` is present but fails schema validation, returns `{ status: 'invalid' }`.
 */
export function deriveFieldsFromDesign(
  designJson: unknown,
  textField: 'body' | 'body_text' = 'body_text',
  options?: { validate?: boolean }
): DeriveResult {
  if (designJson == null) return { status: 'skipped' };

  const parsed = emailDesignSchema.safeParse(designJson);
  if (!parsed.success) {
    return {
      status: 'invalid',
      error: `Invalid design_json: ${parsed.error.issues.map((e: { message: string }) => e.message).join(', ')}`,
    };
  }

  // Run semantic validation (missing image src, empty button url, etc.)
  if (options?.validate) {
    const vErrors = validateDesign(parsed.data);
    if (hasBlockingErrors(vErrors)) {
      const msgs = vErrors
        .filter((e) => e.severity === 'error')
        .map((e) => e.message);
      return { status: 'invalid', error: msgs.join('; ') };
    }
  }

  const html = renderDesignToHtml(parsed.data);
  const text = renderDesignToText(parsed.data);

  return {
    status: 'ok',
    fields: {
      body_html: html,
      [textField]: text,
    },
  };
}
