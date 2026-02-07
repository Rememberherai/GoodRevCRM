import { PDFParse } from 'pdf-parse';

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

export function extractTextFromPlainText(text: string): string {
  return text;
}
