import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';
import { generateInvoicePdf } from '@/lib/accounting/invoice-pdf';
import { sendEmail } from '@/lib/gmail/service';
import type { GmailConnection } from '@/types/gmail';
import { z } from 'zod';

const schema = z.object({
  recipient_email: z.string().email().optional(),
  subject: z.string().optional(),
  body_html: z.string().optional(),
  gmail_connection_id: z.string().uuid(),
});

// POST /api/accounting/invoices/[id]/email
// Sends invoice PDF via email using Gmail
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: invoiceId } = await params;
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx || !hasMinRole(ctx.role, 'member')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const input = schema.parse(body);

    // Fetch invoice
    const { data: invoice, error: invoiceErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .single();

    if (invoiceErr || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'voided') {
      return NextResponse.json({ error: 'Cannot email a voided invoice' }, { status: 400 });
    }

    if (invoice.status === 'draft') {
      const { error: sendError } = await supabase.rpc('send_invoice', {
        p_invoice_id: invoiceId,
      });

      if (sendError) {
        const message = sendError.message || 'Failed to send invoice';
        const status = /not found/i.test(message)
          ? 404
          : /insufficient permissions/i.test(message)
            ? 403
            : /must be configured/i.test(message)
              ? 400
              : 400;
        return NextResponse.json({ error: message }, { status });
      }
    }

    const { data: currentInvoice, error: currentInvoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('company_id', ctx.companyId)
      .is('deleted_at', null)
      .single();

    if (currentInvoiceError || !currentInvoice) {
      return NextResponse.json({ error: 'Invoice sent but could not be loaded' }, { status: 500 });
    }

    // Fetch line items
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('invoice_line_items')
      .select('description, quantity, unit_price, amount, tax_amount')
      .eq('invoice_id', invoiceId)
      .order('sort_order');

    if (lineItemsError) {
      return NextResponse.json({ error: 'Failed to load invoice line items' }, { status: 500 });
    }

    // Fetch company name
    const { data: company, error: companyError } = await supabase
      .from('accounting_companies')
      .select('name')
      .eq('id', ctx.companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: 'Failed to load accounting company' }, { status: 500 });
    }

    // Fetch gmail connection
    const { data: gmailConn, error: gmailError } = await supabase
      .from('gmail_connections')
      .select('*')
      .eq('id', input.gmail_connection_id)
      .eq('user_id', ctx.userId)
      .single();

    if (gmailError || !gmailConn) {
      return NextResponse.json({ error: 'Gmail connection not found' }, { status: 404 });
    }

    if (gmailConn.status !== 'connected') {
      return NextResponse.json(
        { error: 'Gmail connection is not active' },
        { status: 400 },
      );
    }

    // Generate PDF
    const pdfBytes = await generateInvoicePdf({
      invoice_number: currentInvoice.invoice_number,
      invoice_date: currentInvoice.invoice_date,
      due_date: currentInvoice.due_date,
      status: currentInvoice.status,
      customer_name: currentInvoice.customer_name,
      customer_email: currentInvoice.customer_email,
      customer_address:
        typeof currentInvoice.customer_address === 'string' ? currentInvoice.customer_address : null,
      currency: currentInvoice.currency,
      subtotal: Number(currentInvoice.subtotal),
      tax_total: Number(currentInvoice.tax_total ?? 0),
      total: Number(currentInvoice.total),
      amount_paid: Number(currentInvoice.amount_paid),
      balance_due: Number(currentInvoice.balance_due),
      notes: currentInvoice.notes,
      footer: currentInvoice.footer,
      line_items: (lineItems ?? []).map((li) => ({
        description: li.description,
        quantity: Number(li.quantity),
        unit_price: Number(li.unit_price),
        amount: Number(li.amount),
        tax_amount: Number(li.tax_amount ?? 0),
      })),
      company_name: company?.name ?? 'Company',
    });

    const recipientEmail = input.recipient_email || currentInvoice.customer_email;
    if (!recipientEmail) {
      return NextResponse.json(
        { error: 'No recipient email — provide one or set customer email on the invoice' },
        { status: 400 },
      );
    }

    const emailSubject =
      input.subject || `Invoice ${currentInvoice.invoice_number} from ${company.name}`;
    const emailBody =
      input.body_html ||
      `<p>Please find attached invoice <strong>${currentInvoice.invoice_number}</strong> for <strong>${Number(currentInvoice.total).toLocaleString('en-US', { style: 'currency', currency: currentInvoice.currency })}</strong>.</p><p>Due date: ${currentInvoice.due_date}</p><p>Thank you for your business.</p>`;

    // Send email with PDF attachment
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    const emailResult = await sendEmail(
      gmailConn as GmailConnection,
      {
        to: recipientEmail,
        subject: emailSubject,
        body_html: emailBody,
        body_text: `Invoice ${currentInvoice.invoice_number} - Amount: ${currentInvoice.total} - Due: ${currentInvoice.due_date}`,
        attachments: [
          {
            filename: `${currentInvoice.invoice_number}.pdf`,
            mimeType: 'application/pdf',
            content: pdfBase64,
          },
        ],
        organization_id: currentInvoice.organization_id ?? undefined,
      },
      ctx.userId,
    );

    return NextResponse.json({
      data: {
        message_id: emailResult.message_id,
        sent_to: recipientEmail,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 },
      );
    }
    console.error('Error emailing invoice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
