import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createServiceClient } from '@/lib/supabase/server';

/** Map of font names (matching the signing page SIGNATURE_FONTS) to local .ttf files */
const SIGNATURE_FONT_FILES: Record<string, string> = {
  'Dancing Script': 'DancingScript.ttf',
  'Caveat': 'Caveat.ttf',
  'Great Vibes': 'GreatVibes.ttf',
  'Kalam': 'Kalam.ttf',
  'Pacifico': 'Pacifico.ttf',
};

const FONTS_DIR = join(process.cwd(), 'lib', 'contracts', 'fonts');

interface FlattenOptions {
  documentId: string;
  projectId: string;
}

interface RecipientData {
  id: string;
  name: string;
  signature_data: { type: string; data: string; font?: string } | null;
  initials_data: { type: string; data: string; font?: string } | null;
}

interface FieldData {
  id: string;
  recipient_id: string;
  field_type: string;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | null;
}

export async function flattenPdf(options: FlattenOptions): Promise<{
  pdfBytes: Uint8Array;
  hash: string;
}> {
  const { documentId } = options;
  const supabase = createServiceClient();

  // Get document
  const { data: document } = await supabase
    .from('contract_documents')
    .select('original_file_path')
    .eq('id', documentId)
    .single();

  if (!document) throw new Error('Document not found');

  // Download original PDF
  const { data: fileData } = await supabase.storage
    .from('contracts')
    .download(document.original_file_path);

  if (!fileData) throw new Error('Failed to download original PDF');

  const originalBytes = new Uint8Array(await fileData.arrayBuffer());
  const pdfDoc = await PDFDocument.load(originalBytes);
  pdfDoc.registerFontkit(fontkit);
  const fallbackFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  // Cache for embedded signature fonts (loaded on demand per recipient)
  const embeddedFontCache = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedFont>>>();

  async function getSignatureFont(fontName?: string) {
    if (!fontName) return fallbackFont;
    const cached = embeddedFontCache.get(fontName);
    if (cached) return cached;
    const fileName = SIGNATURE_FONT_FILES[fontName];
    if (!fileName) return fallbackFont;
    try {
      const fontBytes = await readFile(join(FONTS_DIR, fileName));
      const embedded = await pdfDoc.embedFont(fontBytes);
      embeddedFontCache.set(fontName, embedded);
      return embedded;
    } catch (err) {
      console.error(`[FLATTEN] Failed to load font ${fontName}:`, err);
      return fallbackFont;
    }
  }

  // Get recipients with signature data
  const { data: recipients } = await supabase
    .from('contract_recipients')
    .select('id, name, signature_data, initials_data')
    .eq('document_id', documentId)
    .eq('status', 'signed');

  const recipientMap = new Map<string, RecipientData>();
  for (const r of recipients ?? []) {
    recipientMap.set(r.id, {
      id: r.id,
      name: r.name,
      signature_data: r.signature_data as RecipientData['signature_data'],
      initials_data: r.initials_data as RecipientData['initials_data'],
    });
  }

  // Get all fields
  const { data: fields } = await supabase
    .from('contract_fields')
    .select('id, recipient_id, field_type, page_number, x, y, width, height, value')
    .eq('document_id', documentId);

  for (const field of (fields ?? []) as FieldData[]) {
    if (!field.value) continue;

    const pageIndex = field.page_number - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex]!;
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Convert percentage to absolute coordinates
    const x = (Number(field.x) / 100) * pageWidth;
    const y = pageHeight - ((Number(field.y) / 100) * pageHeight) - ((Number(field.height) / 100) * pageHeight);
    const fieldWidth = (Number(field.width) / 100) * pageWidth;
    const fieldHeight = (Number(field.height) / 100) * pageHeight;

    if (field.field_type === 'signature' || field.field_type === 'initials') {
      const recipient = recipientMap.get(field.recipient_id);
      const sigData = field.field_type === 'signature'
        ? recipient?.signature_data
        : recipient?.initials_data;

      if (sigData) {
        if (sigData.type === 'type') {
          // Render typed signature with the user's chosen font
          const sigFont = await getSignatureFont(sigData.font);
          const fontSize = Math.min(fieldHeight * 0.6, 24);
          page.drawText(sigData.data, {
            x: x + 4,
            y: y + fieldHeight * 0.3,
            size: fontSize,
            font: sigFont,
            color: rgb(0.05, 0.05, 0.3),
          });
        } else if (sigData.type === 'draw' || sigData.type === 'upload') {
          // Try to embed image
          try {
            const formatMatch = sigData.data.match(/^data:image\/(\w+);base64,/);
            const format = formatMatch?.[1]?.toLowerCase();
            const base64Data = sigData.data.replace(/^data:image\/\w+;base64,/, '');
            const imageBytes = Buffer.from(base64Data, 'base64');
            const image = format === 'jpeg' || format === 'jpg'
              ? await pdfDoc.embedJpg(imageBytes)
              : await pdfDoc.embedPng(imageBytes);
            const scaled = image.scaleToFit(fieldWidth - 4, fieldHeight - 4);
            page.drawImage(image, {
              x: x + 2,
              y: y + 2,
              width: scaled.width,
              height: scaled.height,
            });
          } catch {
            // Fallback to text
            page.drawText(`[Signed: ${recipient?.name ?? 'Unknown'}]`, {
              x: x + 4,
              y: y + fieldHeight * 0.3,
              size: 10,
              font: fallbackFont,
              color: rgb(0.05, 0.05, 0.3),
            });
          }
        } else {
          // Adopted signature - render name
          const fontSize = Math.min(fieldHeight * 0.6, 20);
          const adoptFont = await getSignatureFont(sigData.font);
          page.drawText(recipient?.name ?? 'Signed', {
            x: x + 4,
            y: y + fieldHeight * 0.3,
            size: fontSize,
            font: adoptFont,
            color: rgb(0.05, 0.05, 0.3),
          });
        }
      }
    } else if (field.field_type === 'checkbox') {
      if (field.value === 'true') {
        page.drawText('X', {
          x: x + fieldWidth * 0.25,
          y: y + fieldHeight * 0.2,
          size: Math.min(fieldHeight * 0.7, 16),
          font: fallbackFont,
          color: rgb(0, 0, 0),
        });
      }
    } else if (field.field_type === 'date_signed') {
      page.drawText(field.value, {
        x: x + 4,
        y: y + fieldHeight * 0.3,
        size: Math.min(fieldHeight * 0.5, 11),
        font: fallbackFont,
        color: rgb(0, 0, 0),
      });
    } else {
      // Text fields
      const fontSize = Math.min(fieldHeight * 0.5, 11);
      page.drawText(field.value, {
        x: x + 4,
        y: y + fieldHeight * 0.3,
        size: fontSize,
        font: fallbackFont,
        color: rgb(0, 0, 0),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update(pdfBytes).digest('hex');

  return { pdfBytes: new Uint8Array(pdfBytes), hash };
}
