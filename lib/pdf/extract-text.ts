import { extractText } from 'unpdf';

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(buffer));
  return Array.isArray(text) ? text.join('\n') : text;
}

export function extractTextFromPlainText(text: string): string {
  return text;
}
