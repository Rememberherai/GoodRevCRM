import { describe, it, expect } from 'vitest';
import { deriveFieldsFromDesign } from '@/lib/email-builder/derive-fields';
import { renderDesignToHtml, renderDesignToInnerHtml } from '@/lib/email-builder/render-html';
import { renderDesignToText } from '@/lib/email-builder/render-text';
import { validateDesign, hasBlockingErrors, hasWarningsOnly } from '@/lib/email-builder/validation';
import { createDefaultDesign, createDefaultBlock } from '@/lib/email-builder/default-blocks';
import { emailDesignSchema } from '@/lib/email-builder/schema';
import { createBroadcastSchema, updateBroadcastSchema } from '@/lib/validators/community/broadcasts';
import { createTemplateSchema } from '@/lib/validators/email-template';
import type { EmailDesign } from '@/types/email-builder';

// ── Test helpers ────────────────────────────────────────────────────────────

function makeDesign(blocks: EmailDesign['blocks'] = []): EmailDesign {
  return { ...createDefaultDesign(), blocks };
}

function makeTextBlock(html: string) {
  return { ...createDefaultBlock('text'), html } as EmailDesign['blocks'][0];
}

// ── deriveFieldsFromDesign ──────────────────────────────────────────────────

describe('deriveFieldsFromDesign', () => {
  it('returns skipped for null design_json', () => {
    expect(deriveFieldsFromDesign(null)).toEqual({ status: 'skipped' });
  });

  it('returns skipped for undefined design_json', () => {
    expect(deriveFieldsFromDesign(undefined)).toEqual({ status: 'skipped' });
  });

  it('returns invalid for malformed design_json', () => {
    const result = deriveFieldsFromDesign({ bad: true });
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.error).toContain('Invalid design_json');
    }
  });

  it('returns invalid for design_json missing required fields', () => {
    const result = deriveFieldsFromDesign({ version: 1, globalStyles: {} });
    expect(result.status).toBe('invalid');
  });

  it('derives body_html and body_text from valid design', () => {
    const design = makeDesign([makeTextBlock('<p>Hello</p>')]);
    const result = deriveFieldsFromDesign(design, 'body_text');
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.fields.body_html).toContain('Hello');
      expect(result.fields.body_text).toContain('Hello');
      expect(result.fields.body).toBeUndefined();
    }
  });

  it('derives body_html and body (not body_text) when textField is body', () => {
    const design = makeDesign([makeTextBlock('<p>Test</p>')]);
    const result = deriveFieldsFromDesign(design, 'body');
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.fields.body_html).toContain('Test');
      expect(result.fields.body).toContain('Test');
      expect(result.fields.body_text).toBeUndefined();
    }
  });

  it('derives from design with multiple block types', () => {
    const design = makeDesign([
      makeTextBlock('<p>Intro</p>'),
      createDefaultBlock('button'),
      createDefaultBlock('divider'),
      createDefaultBlock('spacer'),
      createDefaultBlock('image'),
    ]);
    const result = deriveFieldsFromDesign(design, 'body_text');
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.fields.body_html).toContain('Intro');
      // Button defaults to "Click Here"
      expect(result.fields.body_text).toContain('Click Here');
    }
  });
});

// ── renderDesignToHtml ──────────────────────────────────────────────────────

describe('renderDesignToHtml', () => {
  it('produces valid HTML document structure', () => {
    const design = makeDesign([makeTextBlock('<p>Hi</p>')]);
    const html = renderDesignToHtml(design);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('Hi');
  });

  it('uses table-based layout', () => {
    const design = makeDesign([makeTextBlock('<p>Test</p>')]);
    const html = renderDesignToHtml(design);
    expect(html).toContain('role="presentation"');
    expect(html).toContain('<table');
  });

  it('includes MSO conditionals for Outlook', () => {
    const design = makeDesign([makeTextBlock('<p>Test</p>')]);
    const html = renderDesignToHtml(design);
    expect(html).toContain('<!--[if mso]>');
  });

  it('uses inline styles (no <style> blocks)', () => {
    const design = makeDesign([makeTextBlock('<p>Test</p>')]);
    const html = renderDesignToHtml(design);
    expect(html).not.toContain('<style>');
    expect(html).not.toContain('<style ');
  });

  it('renders image block with correct attributes', () => {
    const img = { ...createDefaultBlock('image'), src: 'https://example.com/img.png', alt: 'My Image' };
    const html = renderDesignToHtml(makeDesign([img]));
    expect(html).toContain('src="https://example.com/img.png"');
    expect(html).toContain('alt="My Image"');
  });

  it('renders button block with link', () => {
    const btn = { ...createDefaultBlock('button'), text: 'Go', url: 'https://example.com' };
    const html = renderDesignToHtml(makeDesign([btn]));
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('Go');
  });

  it('renders divider block', () => {
    const html = renderDesignToHtml(makeDesign([createDefaultBlock('divider')]));
    expect(html).toContain('<hr');
  });

  it('renders spacer block', () => {
    const html = renderDesignToHtml(makeDesign([createDefaultBlock('spacer')]));
    expect(html).toContain('height:24px');
  });

  it('escapes HTML entities in image/button content', () => {
    const btn = { ...createDefaultBlock('button'), text: '<script>alert("xss")</script>', url: 'https://a.com/b?c=1&d=2' };
    const html = renderDesignToHtml(makeDesign([btn]));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;d=2');
  });
});

// ── renderDesignToInnerHtml ──────────────────────────────────────────────────

describe('renderDesignToInnerHtml', () => {
  it('does not produce a full HTML document', () => {
    const design = makeDesign([makeTextBlock('<p>Hi</p>')]);
    const html = renderDesignToInnerHtml(design);
    expect(html).not.toContain('<!DOCTYPE');
    expect(html).not.toContain('<html');
    expect(html).not.toContain('<body');
    expect(html).toContain('Hi');
  });

  it('renders block content without table row wrappers', () => {
    const design = makeDesign([makeTextBlock('<p>Content</p>')]);
    const html = renderDesignToInnerHtml(design);
    // Inner HTML uses styled divs, not table rows
    expect(html).not.toContain('<tr>');
    expect(html).toContain('Content');
  });

  it('round-trip: inner HTML placed in text block does not nest document', () => {
    // Simulate builder→HTML→builder round-trip
    const original = makeDesign([makeTextBlock('<p>Original</p>')]);
    const innerHtml = renderDesignToInnerHtml(original);

    // Simulate converting back to builder (HTML → single text block)
    const roundTripped = makeDesign([makeTextBlock(innerHtml)]);
    const finalHtml = renderDesignToHtml(roundTripped);

    // Should have exactly one DOCTYPE, one <html>, one <body>
    expect(finalHtml.match(/<!DOCTYPE/g)?.length).toBe(1);
    expect(finalHtml.match(/<html/g)?.length).toBe(1);
    expect(finalHtml.match(/<body/g)?.length).toBe(1);
    expect(finalHtml).toContain('Original');
  });
});

// ── renderDesignToText ──────────────────────────────────────────────────────

describe('renderDesignToText', () => {
  it('strips HTML from text blocks', () => {
    const text = renderDesignToText(makeDesign([makeTextBlock('<p><strong>Bold</strong> text</p>')]));
    expect(text).toContain('Bold text');
    expect(text).not.toContain('<');
  });

  it('formats button blocks as [text: url]', () => {
    const btn = { ...createDefaultBlock('button'), text: 'Click', url: 'https://example.com' };
    const text = renderDesignToText(makeDesign([btn]));
    expect(text).toContain('[Click: https://example.com]');
  });

  it('formats image blocks with alt text', () => {
    const img = { ...createDefaultBlock('image'), alt: 'Photo' };
    const text = renderDesignToText(makeDesign([img]));
    expect(text).toContain('[Image: Photo]');
  });

  it('renders divider as ---', () => {
    const text = renderDesignToText(makeDesign([createDefaultBlock('divider')]));
    expect(text).toContain('---');
  });

  it('skips spacer blocks', () => {
    const text = renderDesignToText(makeDesign([createDefaultBlock('spacer')]));
    expect(text).toBe('');
  });
});

// ── validateDesign ──────────────────────────────────────────────────────────

describe('validateDesign', () => {
  it('errors on empty design', () => {
    const errors = validateDesign(makeDesign([]));
    expect(hasBlockingErrors(errors)).toBe(true);
    expect(errors[0]?.message).toContain('no content');
  });

  it('warns on whitespace-only text block', () => {
    const errors = validateDesign(makeDesign([makeTextBlock('<p>   </p>')]));
    expect(errors.some((e) => e.severity === 'warning' && e.field === 'html')).toBe(true);
    expect(hasBlockingErrors(errors)).toBe(false);
  });

  it('errors on image block with no src', () => {
    const img = createDefaultBlock('image'); // src defaults to ''
    const errors = validateDesign(makeDesign([img]));
    expect(hasBlockingErrors(errors)).toBe(true);
    expect(errors.some((e) => e.field === 'src')).toBe(true);
  });

  it('errors on button with no url', () => {
    const btn = createDefaultBlock('button'); // url defaults to ''
    const errors = validateDesign(makeDesign([btn]));
    expect(hasBlockingErrors(errors)).toBe(true);
    expect(errors.some((e) => e.field === 'url')).toBe(true);
  });

  it('passes on valid design', () => {
    const design = makeDesign([makeTextBlock('<p>Hello world</p>')]);
    const errors = validateDesign(design);
    expect(hasBlockingErrors(errors)).toBe(false);
    expect(hasWarningsOnly(errors)).toBe(false);
  });
});

// ── emailDesignSchema ───────────────────────────────────────────────────────

describe('emailDesignSchema', () => {
  it('parses a valid design', () => {
    const design = makeDesign([makeTextBlock('<p>Test</p>')]);
    const result = emailDesignSchema.safeParse(design);
    expect(result.success).toBe(true);
  });

  it('rejects missing version', () => {
    const result = emailDesignSchema.safeParse({ globalStyles: createDefaultDesign().globalStyles, blocks: [] });
    expect(result.success).toBe(false);
  });

  it('rejects invalid block type', () => {
    const result = emailDesignSchema.safeParse({
      version: 1,
      globalStyles: createDefaultDesign().globalStyles,
      blocks: [{ id: '1', type: 'unknown', data: {} }],
    });
    expect(result.success).toBe(false);
  });

  it('validates text block fields', () => {
    const result = emailDesignSchema.safeParse({
      version: 1,
      globalStyles: createDefaultDesign().globalStyles,
      blocks: [{ id: '1', type: 'text', html: '<p>ok</p>', fontSize: 999 }],
    });
    expect(result.success).toBe(false); // fontSize max is 72
  });

  it('rejects invalid color values', () => {
    const result = emailDesignSchema.safeParse({
      version: 1,
      globalStyles: { ...createDefaultDesign().globalStyles, textColor: 'not-a-color' },
      blocks: [makeTextBlock('<p>ok</p>')],
    });
    expect(result.success).toBe(false);
  });
});

// ── Broadcast validator ─────────────────────────────────────────────────────

describe('createBroadcastSchema', () => {
  const base = { subject: 'Test', channel: 'email' as const };

  it('accepts body without design_json', () => {
    const result = createBroadcastSchema.safeParse({ ...base, body: 'Hello world' });
    expect(result.success).toBe(true);
  });

  it('accepts design_json without body', () => {
    const design = makeDesign([makeTextBlock('<p>Hi</p>')]);
    const result = createBroadcastSchema.safeParse({ ...base, design_json: design });
    expect(result.success).toBe(true);
  });

  it('rejects when neither body nor design_json is provided', () => {
    const result = createBroadcastSchema.safeParse({ ...base });
    expect(result.success).toBe(false);
  });

  it('rejects empty body without design_json', () => {
    const result = createBroadcastSchema.safeParse({ ...base, body: '' });
    expect(result.success).toBe(false);
  });

  it('accepts design_json with null body', () => {
    const design = makeDesign([makeTextBlock('<p>Hi</p>')]);
    const result = createBroadcastSchema.safeParse({ ...base, design_json: design, body: undefined });
    expect(result.success).toBe(true);
  });
});

describe('updateBroadcastSchema', () => {
  it('accepts partial updates without body or design_json', () => {
    const result = updateBroadcastSchema.safeParse({ subject: 'New subject' });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with only design_json', () => {
    const design = makeDesign([makeTextBlock('<p>Updated</p>')]);
    const result = updateBroadcastSchema.safeParse({ design_json: design });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (no-op update)', () => {
    const result = updateBroadcastSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects explicitly clearing both body and design_json', () => {
    const result = updateBroadcastSchema.safeParse({ body: '', design_json: null });
    expect(result.success).toBe(false);
  });

  it('accepts clearing body if design_json is not being cleared', () => {
    const result = updateBroadcastSchema.safeParse({ body: '' });
    expect(result.success).toBe(true);
  });

  it('accepts clearing design_json if body is not being cleared', () => {
    const result = updateBroadcastSchema.safeParse({ design_json: null });
    expect(result.success).toBe(true);
  });

  it('accepts setting new design_json while clearing body', () => {
    const design = makeDesign([makeTextBlock('<p>New</p>')]);
    const result = updateBroadcastSchema.safeParse({ body: '', design_json: design });
    expect(result.success).toBe(true);
  });
});

// ── Template validator ──────────────────────────────────────────────────────

describe('createTemplateSchema', () => {
  const base = { name: 'Test', subject: 'Hello' };

  it('accepts body_html without design_json', () => {
    const result = createTemplateSchema.safeParse({ ...base, body_html: '<p>Hi</p>' });
    expect(result.success).toBe(true);
  });

  it('accepts design_json without body_html', () => {
    const design = makeDesign([makeTextBlock('<p>Hi</p>')]);
    const result = createTemplateSchema.safeParse({ ...base, design_json: design });
    expect(result.success).toBe(true);
  });

  it('rejects when neither body_html nor design_json is provided', () => {
    const result = createTemplateSchema.safeParse({ ...base });
    expect(result.success).toBe(false);
  });

  it('rejects empty body_html without design_json', () => {
    const result = createTemplateSchema.safeParse({ ...base, body_html: '' });
    expect(result.success).toBe(false);
  });
});
