import type {
  EmailBlock,
  EmailDesign,
  EmailGlobalStyles,
  TextBlock,
  ImageBlock,
  ButtonBlock,
  DividerBlock,
  SpacerBlock,
} from '@/types/email-builder';

// ── Helpers ───────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineStyle(props: Record<string, string | number | undefined>): string {
  return Object.entries(props)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

function paddingStyle(block: EmailBlock): string {
  const p = block.padding;
  if (!p) return 'padding:0;';
  return `padding:${p.top}px ${p.right}px ${p.bottom}px ${p.left}px;`;
}

function alignToTd(align: string): string {
  return align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
}

// ── Block renderers ───────────────────────────────────────────────────────

function renderTextBlock(block: TextBlock, globals: EmailGlobalStyles): string {
  const fontFamily = block.fontFamily || globals.fontFamily;
  const fontSize = block.fontSize || globals.fontSize;
  const color = block.textColor || globals.textColor;
  const align = block.align || 'left';
  const lineHeight = globals.lineHeight;

  const style = inlineStyle({
    'font-family': fontFamily,
    'font-size': `${fontSize}px`,
    'line-height': String(lineHeight),
    color,
    'text-align': align,
  });

  // Wrap the TipTap HTML in a styled container.
  // TipTap outputs <p>, <strong>, <em>, <a>, <ul>, <ol>, <li>, <h2>, <h3> etc.
  // We apply base styles to the wrapper; inner elements inherit.
  return `<div style="${style}">${block.html}</div>`;
}

function renderImageBlock(block: ImageBlock, globals: EmailGlobalStyles): string {
  const maxWidth = Math.min(block.width, globals.contentWidth);
  const align = alignToTd(block.align);

  const imgAttrs = [
    `src="${esc(block.src)}"`,
    `alt="${esc(block.alt)}"`,
    `width="${maxWidth}"`,
    `style="display:block;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;"`,
  ].join(' ');

  const img = block.src
    ? `<img ${imgAttrs} />`
    : `<div style="width:${maxWidth}px;height:200px;background:#f0f0f0;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:14px;color:#999;">No image</div>`;

  const linked = block.linkUrl
    ? `<a href="${esc(block.linkUrl)}" target="_blank" rel="noopener noreferrer">${img}</a>`
    : img;

  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 ${align === 'center' ? 'auto' : align === 'right' ? '0 0 auto' : '0'};"><tr><td>${linked}</td></tr></table>`;
}

function renderButtonBlock(block: ButtonBlock, globals: EmailGlobalStyles): string {
  const align = alignToTd(block.align);
  const fontFamily = globals.fontFamily;

  // Bulletproof button pattern with mso-padding-alt
  const btnStyle = inlineStyle({
    display: 'inline-block',
    padding: '12px 24px',
    'font-family': fontFamily,
    'font-size': '16px',
    color: block.textColor,
    'text-decoration': 'none',
    'border-radius': `${block.borderRadius}px`,
    'background-color': block.buttonColor,
    border: `1px solid ${block.buttonColor}`,
    'mso-padding-alt': '0',
    'text-align': 'center',
    width: block.fullWidth ? '100%' : undefined,
    'box-sizing': block.fullWidth ? 'border-box' : undefined,
  });

  const tableStyle = block.fullWidth
    ? 'width:100%;'
    : `margin:0 ${align === 'center' ? 'auto' : align === 'right' ? '0 0 auto' : '0'};`;

  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="${block.fullWidth ? '100%' : ''}" style="${tableStyle}"><tr><td align="${align}" style="border-radius:${block.borderRadius}px;background-color:${block.buttonColor};"><a href="${esc(block.url || '#')}" target="_blank" rel="noopener noreferrer" style="${btnStyle}"><!--[if mso]><i style="letter-spacing:24px;mso-font-width:-100%;mso-text-raise:18pt">&nbsp;</i><![endif]--><span style="mso-text-raise:9pt;">${esc(block.text)}</span><!--[if mso]><i style="letter-spacing:24px;mso-font-width:-100%">&nbsp;</i><![endif]--></a></td></tr></table>`;
}

function renderDividerBlock(block: DividerBlock): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="padding:0;"><hr style="border:none;border-top:${block.thickness}px ${block.style} ${block.color};margin:0;" /></td></tr></table>`;
}

function renderSpacerBlock(block: SpacerBlock): string {
  return `<div style="height:${block.height}px;line-height:${block.height}px;font-size:1px;">&nbsp;</div>`;
}

// ── Main block dispatcher ─────────────────────────────────────────────────

function renderBlock(block: EmailBlock, globals: EmailGlobalStyles): string {
  const bg = block.backgroundColor ? `background-color:${block.backgroundColor};` : '';
  const padding = paddingStyle(block);

  let inner: string;
  switch (block.type) {
    case 'text':
      inner = renderTextBlock(block, globals);
      break;
    case 'image':
      inner = renderImageBlock(block, globals);
      break;
    case 'button':
      inner = renderButtonBlock(block, globals);
      break;
    case 'divider':
      inner = renderDividerBlock(block);
      break;
    case 'spacer':
      inner = renderSpacerBlock(block);
      break;
    default:
      inner = '';
  }

  return `<tr><td style="${bg}${padding}">${inner}</td></tr>`;
}

// ── Document renderer ─────────────────────────────────────────────────────

/**
 * Render an EmailDesign to email-client-compatible HTML.
 *
 * - Table-based layout with inline CSS
 * - MSO conditional comments for Outlook
 * - No <style> blocks (Gmail strips them)
 * - Web-safe fonts only
 * - Fluid widths + max-width for responsive
 */
/**
 * Render just the inner block-level HTML without the full email document wrapper.
 * Used when converting builder content to editable HTML (e.g., builder → HTML mode toggle).
 * This avoids nesting a full <!DOCTYPE html> document inside a text block on round-trip.
 */
export function renderDesignToInnerHtml(design: EmailDesign): string {
  return design.blocks
    .map((b) => {
      let inner: string;
      switch (b.type) {
        case 'text':
          inner = renderTextBlock(b, design.globalStyles);
          break;
        case 'image':
          inner = renderImageBlock(b, design.globalStyles);
          break;
        case 'button':
          inner = renderButtonBlock(b, design.globalStyles);
          break;
        case 'divider':
          inner = renderDividerBlock(b);
          break;
        case 'spacer':
          inner = renderSpacerBlock(b);
          break;
        default:
          return '';
      }

      // Apply block-level padding and backgroundColor (mirroring renderBlock's wrapper)
      const bg = b.backgroundColor ? `background-color:${b.backgroundColor};` : '';
      const padding = paddingStyle(b);
      const wrapperStyle = `${bg}${padding}`.trim();
      return wrapperStyle ? `<div style="${wrapperStyle}">${inner}</div>` : inner;
    })
    .filter(Boolean)
    .join('\n');
}

export function renderDesignToHtml(design: EmailDesign): string {
  const g = design.globalStyles;
  const blocksHtml = design.blocks.map((b) => renderBlock(b, g)).join('\n');

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<!--[if mso]>
<noscript><xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml></noscript>
<![endif]-->
<title></title>
</head>
<body style="margin:0;padding:0;background-color:${g.backgroundColor};font-family:${g.fontFamily};font-size:${g.fontSize}px;line-height:${g.lineHeight};color:${g.textColor};">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${g.backgroundColor};">
<tr>
<td align="center" style="padding:0;">
<!--[if mso]><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="${g.contentWidth}"><tr><td><![endif]-->
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="${g.contentWidth}" style="max-width:${g.contentWidth}px;margin:0 auto;background-color:#ffffff;">
${blocksHtml}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td>
</tr>
</table>
</body>
</html>`;
}
