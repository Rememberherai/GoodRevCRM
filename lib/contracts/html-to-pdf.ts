import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface TextBlock {
  type: 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'listItem' | 'hr';
  text: string;
  bold?: boolean;
  italic?: boolean;
  listIndex?: number;
}

const PAGE_WIDTH = 612; // Letter size
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 72;
const MARGIN_RIGHT = 72;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 72;
const USABLE_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const FONT_SIZES: Record<TextBlock['type'], number> = {
  heading1: 20,
  heading2: 16,
  heading3: 13,
  paragraph: 11,
  listItem: 11,
  hr: 0,
};

const LINE_HEIGHTS: Record<TextBlock['type'], number> = {
  heading1: 28,
  heading2: 22,
  heading3: 18,
  paragraph: 16,
  listItem: 16,
  hr: 12,
};

const SPACING_AFTER: Record<TextBlock['type'], number> = {
  heading1: 12,
  heading2: 10,
  heading3: 8,
  paragraph: 8,
  listItem: 4,
  hr: 8,
};

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function parseHtmlToBlocks(html: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  // Split into block-level elements
  const blockPattern = /<(h[1-3]|p|li|hr|ul|ol)(?:\s[^>]*)?>[\s\S]*?<\/\1>|<hr\s*\/?>/gi;
  const matches = html.match(blockPattern);

  if (!matches || matches.length === 0) {
    // Fallback: treat entire content as a paragraph
    const text = stripHtmlTags(html);
    if (text) {
      blocks.push({ type: 'paragraph', text });
    }
    return blocks;
  }

  let listCounter = 0;
  let inOrderedList = false;

  for (const match of matches) {
    const tagMatch = match.match(/^<(h[1-3]|p|li|hr|ul|ol)/i);
    if (!tagMatch) continue;

    const tag = tagMatch[1]!.toLowerCase();

    if (tag === 'ul') { inOrderedList = false; listCounter = 0; continue; }
    if (tag === 'ol') { inOrderedList = true; listCounter = 0; continue; }

    if (tag === 'hr') {
      blocks.push({ type: 'hr', text: '' });
      continue;
    }

    const text = stripHtmlTags(match);
    if (!text) continue;

    const hasBold = /<(strong|b)\b/i.test(match);
    const hasItalic = /<(em|i)\b/i.test(match);

    if (tag === 'h1') {
      blocks.push({ type: 'heading1', text, bold: true });
    } else if (tag === 'h2') {
      blocks.push({ type: 'heading2', text, bold: true });
    } else if (tag === 'h3') {
      blocks.push({ type: 'heading3', text, bold: true });
    } else if (tag === 'li') {
      listCounter++;
      blocks.push({
        type: 'listItem',
        text: inOrderedList ? `${listCounter}. ${text}` : `•  ${text}`,
        bold: hasBold,
        italic: hasItalic,
      });
    } else {
      blocks.push({ type: 'paragraph', text, bold: hasBold, italic: hasItalic });
    }
  }

  return blocks;
}

function wrapText(text: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.length > 0 ? lines : [''];
}

export async function htmlToPdf(
  html: string,
  options?: { includeSignatureLine?: boolean },
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const blocks = parseHtmlToBlocks(html);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN_BOTTOM) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_TOP;
    }
  }

  for (const block of blocks) {
    if (block.type === 'hr') {
      ensureSpace(LINE_HEIGHTS.hr);
      y -= 6;
      page.drawLine({
        start: { x: MARGIN_LEFT, y },
        end: { x: PAGE_WIDTH - MARGIN_RIGHT, y },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      });
      y -= 6 + SPACING_AFTER.hr;
      continue;
    }

    const fontSize = FONT_SIZES[block.type];
    const lineHeight = LINE_HEIGHTS[block.type];
    const selectedFont = block.bold ? fontBold : block.italic ? fontItalic : font;

    const indent = block.type === 'listItem' ? 18 : 0;
    const lines = wrapText(block.text, selectedFont, fontSize, USABLE_WIDTH - indent);

    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, {
        x: MARGIN_LEFT + indent,
        y: y - fontSize,
        size: fontSize,
        font: selectedFont,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= lineHeight;
    }

    y -= SPACING_AFTER[block.type];
  }

  // Signature section
  if (options?.includeSignatureLine !== false) {
    const sigSpaceNeeded = 100;
    ensureSpace(sigSpaceNeeded);

    y -= 30;

    // Signature line
    page.drawText('Signature:', { x: MARGIN_LEFT, y: y - 11, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
    const sigLineStart = MARGIN_LEFT + font.widthOfTextAtSize('Signature:  ', 11);
    page.drawLine({
      start: { x: sigLineStart, y: y - 12 },
      end: { x: sigLineStart + 200, y: y - 12 },
      thickness: 0.75,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 30;

    // Date line
    page.drawText('Date:', { x: MARGIN_LEFT, y: y - 11, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
    const dateLineStart = MARGIN_LEFT + font.widthOfTextAtSize('Date:  ', 11);
    page.drawLine({
      start: { x: dateLineStart, y: y - 12 },
      end: { x: dateLineStart + 200, y: y - 12 },
      thickness: 0.75,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  return pdfDoc.save();
}
