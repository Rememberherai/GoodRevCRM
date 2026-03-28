import type { EmailBlock, EmailDesign } from '@/types/email-builder';

/**
 * Strip HTML tags and decode common entities to produce plain text.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?(div|p|h[1-6]|li|tr|td|th|blockquote)[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderBlockToText(block: EmailBlock): string {
  switch (block.type) {
    case 'text':
      return htmlToText(block.html);

    case 'image':
      return block.alt ? `[Image: ${block.alt}]` : '[Image]';

    case 'button':
      return block.url ? `[${block.text}: ${block.url}]` : `[${block.text}]`;

    case 'divider':
      return '---';

    case 'spacer':
      return '';

    default:
      return '';
  }
}

/**
 * Convert an EmailDesign to plain text (for body_text / SMS fallback).
 */
export function renderDesignToText(design: EmailDesign): string {
  return design.blocks
    .map(renderBlockToText)
    .filter((line) => line.length > 0)
    .join('\n\n');
}
