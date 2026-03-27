import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';

interface TicketPdfData {
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  registrantName: string;
  registrantEmail: string;
  tickets: {
    qrCode: string;
    attendeeName?: string | null;
    ticketTypeName?: string | null;
  }[];
  appUrl: string;
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

function drawCentered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0, 0, 0),
) {
  const pageWidth = page.getWidth();
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (pageWidth - textWidth) / 2, y, size, font, color });
}

/**
 * Generate a PDF with event ticket(s) including QR codes.
 * Each ticket gets its own section; multiple tickets share a page when possible.
 */
export async function generateTicketPdf(data: TicketPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const gray = rgb(0.4, 0.4, 0.4);
  const darkGray = rgb(0.15, 0.15, 0.15);

  const pageWidth = 612; // US Letter
  const pageHeight = 792;
  const marginLeft = 50;
  const qrSize = 150;

  for (let i = 0; i < data.tickets.length; i++) {
    const ticket = data.tickets[i]!;

    // Start a new page for each ticket (clean layout)
    const page = doc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - 60;

    // Header
    drawCentered(page, data.eventTitle, y, fontBold, 18, darkGray);
    y -= 28;

    // Event details
    drawCentered(page, data.eventDate, y, font, 11, gray);
    y -= 16;
    drawCentered(page, data.eventLocation, y, font, 11, gray);
    y -= 40;

    // Divider
    page.drawLine({
      start: { x: marginLeft, y },
      end: { x: pageWidth - marginLeft, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 30;

    // Ticket label
    if (data.tickets.length > 1) {
      drawCentered(page, `Ticket ${i + 1} of ${data.tickets.length}`, y, fontBold, 12, gray);
      y -= 24;
    }

    // Attendee info
    const name = ticket.attendeeName || data.registrantName;
    drawText(page, 'Name', marginLeft, y, font, 10, gray);
    drawText(page, name, marginLeft + 80, y, fontBold, 12, darkGray);
    y -= 20;

    drawText(page, 'Email', marginLeft, y, font, 10, gray);
    drawText(page, data.registrantEmail, marginLeft + 80, y, font, 11, darkGray);
    y -= 20;

    if (ticket.ticketTypeName) {
      drawText(page, 'Ticket', marginLeft, y, font, 10, gray);
      drawText(page, ticket.ticketTypeName, marginLeft + 80, y, font, 11, darkGray);
      y -= 20;
    }

    y -= 20;

    // QR code
    const ticketUrl = `${data.appUrl}/events/ticket/${ticket.qrCode}`;
    const qrPngBuffer = await QRCode.toBuffer(ticketUrl, {
      type: 'png',
      width: qrSize * 2, // 2x for sharpness
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    const qrImage = await doc.embedPng(qrPngBuffer);
    const qrX = (pageWidth - qrSize) / 2;
    page.drawImage(qrImage, {
      x: qrX,
      y: y - qrSize,
      width: qrSize,
      height: qrSize,
    });
    y -= qrSize + 16;

    drawCentered(page, 'Scan QR code at the event for check-in', y, font, 10, gray);
    y -= 30;

    // Divider
    page.drawLine({
      start: { x: marginLeft, y },
      end: { x: pageWidth - marginLeft, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 20;

    // Footer
    drawCentered(page, 'Present this ticket on your phone or printed at the event.', y, font, 9, gray);
  }

  return doc.save();
}
