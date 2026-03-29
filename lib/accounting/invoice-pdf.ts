import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_amount?: number;
}

interface InvoicePdfData {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  customer_name: string;
  customer_email?: string | null;
  customer_address?: string | null;
  currency: string;
  subtotal: number;
  discount_amount?: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  notes?: string | null;
  footer?: string | null;
  line_items: InvoiceLineItem[];
  // Company info
  company_name: string;
  company_currency?: string;
}

function fmt(n: number, currency: string = 'USD'): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0, 0, 0),
) {
  page.drawText(text, { x, y, size, font, color });
}

function drawRightAligned(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0, 0, 0),
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - width, y, size, font, color });
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const gray = rgb(0.4, 0.4, 0.4);
  const darkGray = rgb(0.2, 0.2, 0.2);
  const headerBlue = rgb(0.1, 0.3, 0.6);

  const marginLeft = 50;
  const marginRight = 562;
  let y = 740;

  // --- Header ---
  drawText(page, 'INVOICE', marginLeft, y, fontBold, 24, headerBlue);
  drawRightAligned(page, data.company_name, marginRight, y, fontBold, 14, darkGray);
  y -= 30;

  drawText(page, `#${data.invoice_number}`, marginLeft, y, font, 12, gray);
  y -= 30;

  // --- Invoice info ---
  drawText(page, 'Invoice Date:', marginLeft, y, font, 9, gray);
  drawText(page, data.invoice_date, marginLeft + 75, y, font, 9, darkGray);
  y -= 15;
  drawText(page, 'Due Date:', marginLeft, y, font, 9, gray);
  drawText(page, data.due_date, marginLeft + 75, y, font, 9, darkGray);
  y -= 15;
  drawText(page, 'Status:', marginLeft, y, font, 9, gray);
  drawText(page, data.status.replace(/_/g, ' ').toUpperCase(), marginLeft + 75, y, fontBold, 9, darkGray);
  y -= 25;

  // --- Bill To ---
  drawText(page, 'BILL TO', marginLeft, y, fontBold, 9, gray);
  y -= 15;
  drawText(page, data.customer_name, marginLeft, y, fontBold, 11, darkGray);
  y -= 14;
  if (data.customer_email) {
    drawText(page, data.customer_email, marginLeft, y, font, 9, gray);
    y -= 14;
  }
  if (data.customer_address) {
    // Split long addresses into lines
    const addrLines = data.customer_address.split(',').map((s) => s.trim());
    for (const line of addrLines) {
      drawText(page, line, marginLeft, y, font, 9, gray);
      y -= 13;
    }
  }
  y -= 15;

  // --- Line items table ---
  const colDesc = marginLeft;
  const colQty = 340;
  const colPrice = 410;
  const colAmount = marginRight;

  // Header row
  page.drawRectangle({
    x: marginLeft - 5,
    y: y - 4,
    width: marginRight - marginLeft + 10,
    height: 18,
    color: rgb(0.95, 0.95, 0.95),
  });
  drawText(page, 'Description', colDesc, y, fontBold, 9, darkGray);
  drawText(page, 'Qty', colQty, y, fontBold, 9, darkGray);
  drawText(page, 'Unit Price', colPrice, y, fontBold, 9, darkGray);
  drawRightAligned(page, 'Amount', colAmount, y, fontBold, 9, darkGray);
  y -= 22;

  // Line items
  let truncated = false;
  for (let li = 0; li < data.line_items.length; li++) {
    const item = data.line_items[li]!;
    if (y < 120) {
      // Not enough vertical space — note truncation and stop
      truncated = true;
      break;
    }

    // Truncate description if too long
    let desc = item.description || '';
    if (font.widthOfTextAtSize(desc, 9) > colQty - colDesc - 10) {
      while (desc.length > 0 && font.widthOfTextAtSize(desc + '...', 9) > colQty - colDesc - 10) {
        desc = desc.slice(0, -1);
      }
      desc += '...';
    }

    drawText(page, desc, colDesc, y, font, 9, darkGray);
    drawText(page, String(item.quantity), colQty, y, font, 9, darkGray);
    drawText(page, fmt(item.unit_price, data.currency), colPrice, y, font, 9, darkGray);
    drawRightAligned(page, fmt(item.amount, data.currency), colAmount, y, font, 9, darkGray);
    y -= 16;
  }

  if (truncated) {
    drawText(page, `(${data.line_items.length} line items total — PDF truncated, see invoice details for full list)`, colDesc, y, font, 8, gray);
    y -= 14;
  }

  // --- Separator line ---
  y -= 5;
  page.drawLine({
    start: { x: 350, y },
    end: { x: marginRight, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 15;

  // --- Totals ---
  const totalsX = 400;

  drawText(page, 'Subtotal:', totalsX, y, font, 9, gray);
  drawRightAligned(page, fmt(data.subtotal, data.currency), colAmount, y, font, 9, darkGray);
  y -= 15;

  if (data.discount_amount && data.discount_amount > 0) {
    drawText(page, 'Discount:', totalsX, y, font, 9, gray);
    drawRightAligned(page, `-${fmt(data.discount_amount, data.currency)}`, colAmount, y, font, 9, darkGray);
    y -= 15;
  }

  if (data.tax_total > 0) {
    drawText(page, 'Tax:', totalsX, y, font, 9, gray);
    drawRightAligned(page, fmt(data.tax_total, data.currency), colAmount, y, font, 9, darkGray);
    y -= 15;
  }

  // Total
  page.drawLine({
    start: { x: totalsX - 5, y: y + 3 },
    end: { x: marginRight, y: y + 3 },
    thickness: 1,
    color: headerBlue,
  });
  y -= 2;
  drawText(page, 'Total:', totalsX, y, fontBold, 11, darkGray);
  drawRightAligned(page, fmt(data.total, data.currency), colAmount, y, fontBold, 11, headerBlue);
  y -= 18;

  if (data.amount_paid > 0) {
    drawText(page, 'Amount Paid:', totalsX, y, font, 9, gray);
    drawRightAligned(page, fmt(data.amount_paid, data.currency), colAmount, y, font, 9, darkGray);
    y -= 15;
  }

  if (data.balance_due !== data.total) {
    drawText(page, 'Balance Due:', totalsX, y, fontBold, 10, darkGray);
    drawRightAligned(page, fmt(data.balance_due, data.currency), colAmount, y, fontBold, 10, headerBlue);
    y -= 15;
  }

  // --- Notes ---
  if (data.notes) {
    y -= 15;
    drawText(page, 'Notes:', marginLeft, y, fontBold, 9, gray);
    y -= 14;
    // Wrap notes text simply
    const words = data.notes.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, 9) > 500) {
        drawText(page, line, marginLeft, y, font, 9, darkGray);
        y -= 13;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      drawText(page, line, marginLeft, y, font, 9, darkGray);
      y -= 13;
    }
  }

  // --- Footer ---
  if (data.footer) {
    const footerY = 40;
    page.drawLine({
      start: { x: marginLeft, y: footerY + 10 },
      end: { x: marginRight, y: footerY + 10 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });
    drawText(page, data.footer, marginLeft, footerY, font, 8, gray);
  }

  const bytes = await doc.save();
  return new Uint8Array(bytes);
}
