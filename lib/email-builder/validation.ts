import type { EmailDesign, ValidationError } from '@/types/email-builder';
import { renderDesignToHtml } from '@/lib/email-builder/render-html';

/** Gmail clips emails larger than ~102 KB */
const GMAIL_CLIP_THRESHOLD = 102_000;

/**
 * Validate an EmailDesign before send.
 * Returns errors (block send) and warnings (show confirmation dialog).
 */
export function validateDesign(design: EmailDesign): ValidationError[] {
  const errors: ValidationError[] = [];

  if (design.blocks.length === 0) {
    errors.push({
      message: 'Email has no content blocks.',
      severity: 'error',
    });
    return errors;
  }

  for (const block of design.blocks) {
    switch (block.type) {
      case 'text': {
        const stripped = block.html.replace(/<[^>]*>/g, '').trim();
        if (!stripped) {
          errors.push({
            blockId: block.id,
            field: 'html',
            message: 'Text block is empty.',
            severity: 'warning',
          });
        }
        break;
      }

      case 'image': {
        if (!block.src) {
          errors.push({
            blockId: block.id,
            field: 'src',
            message: 'Image block has no image URL.',
            severity: 'error',
          });
        }
        break;
      }

      case 'button': {
        if (!block.url) {
          errors.push({
            blockId: block.id,
            field: 'url',
            message: 'Button has no link URL.',
            severity: 'error',
          });
        }
        if (!block.text.trim()) {
          errors.push({
            blockId: block.id,
            field: 'text',
            message: 'Button has no text.',
            severity: 'warning',
          });
        }
        break;
      }

      // divider and spacer have no required content
      default:
        break;
    }
  }

  // Warn when rendered HTML exceeds Gmail's ~102 KB clip threshold
  const html = renderDesignToHtml(design);
  const htmlSizeKb = Math.round(new TextEncoder().encode(html).byteLength / 1024);
  if (htmlSizeKb > Math.round(GMAIL_CLIP_THRESHOLD / 1024)) {
    errors.push({
      message: `Rendered email is ${htmlSizeKb} KB — Gmail clips messages over ~102 KB.`,
      severity: 'warning',
    });
  }

  return errors;
}

/**
 * Check if any validation errors are severity 'error' (blocking).
 */
export function hasBlockingErrors(errors: ValidationError[]): boolean {
  return errors.some((e) => e.severity === 'error');
}

/**
 * Check if there are warnings but no blocking errors.
 */
export function hasWarningsOnly(errors: ValidationError[]): boolean {
  return errors.length > 0 && !hasBlockingErrors(errors);
}
