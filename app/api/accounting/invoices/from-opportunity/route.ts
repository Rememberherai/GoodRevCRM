import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';
import { z } from 'zod';

const schema = z.object({
  opportunity_id: z.string().uuid(),
});

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// POST /api/accounting/invoices/from-opportunity
// Creates a draft invoice pre-filled from a closed-won opportunity
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx || !hasMinRole(ctx.role, 'member')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { opportunity_id } = schema.parse(body);

    // Fetch the opportunity with org details
    const { data: opp, error: oppErr } = await supabase
      .from('opportunities')
      .select('id, name, amount, currency, stage, organization_id, primary_contact_id, description, project_id, deleted_at')
      .eq('id', opportunity_id)
      .single();

    if (oppErr || !opp) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    if (opp.deleted_at) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    if (opp.stage !== 'closed_won') {
      return NextResponse.json(
        { error: 'Can only create invoices from closed-won opportunities' },
        { status: 400 },
      );
    }

    if (!opp.amount || Number(opp.amount) <= 0) {
      return NextResponse.json(
        { error: 'Opportunity must have a positive amount before creating an invoice' },
        { status: 400 },
      );
    }

    if (opp.project_id) {
      const { data: membership, error: membershipError } = await supabase
        .from('project_memberships')
        .select('user_id')
        .eq('project_id', opp.project_id)
        .eq('user_id', ctx.userId)
        .maybeSingle();

      if (membershipError) {
        console.error('Error checking project membership for opportunity invoice:', membershipError);
        return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
      }

      if (!membership) {
        return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
      }
    }

    // Fetch organization details for customer snapshot
    let customerName = opp.name;
    let customerEmail = '';
    let customerAddress = '';
    let organizationId: string | null = opp.organization_id;
    const contactId: string | null = opp.primary_contact_id;

    if (opp.organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name, address_street, address_city, address_state, address_postal_code, address_country')
        .eq('id', opp.organization_id)
        .single();

      if (org) {
        organizationId = org.id;
        customerName = org.name;
        customerEmail = '';
        customerAddress = [
          org.address_street,
          org.address_city,
          org.address_state,
          org.address_postal_code,
          org.address_country,
        ]
          .filter(Boolean)
          .join(', ');
      }
    }

    // Fetch settings for default revenue account and payment terms
    const [{ data: settings }, { data: company }] = await Promise.all([
      supabase
        .from('accounting_settings')
        .select('default_revenue_account_id, default_payment_terms')
        .eq('company_id', ctx.companyId)
        .single(),
      supabase
        .from('accounting_companies')
        .select('base_currency')
        .eq('id', ctx.companyId)
        .single(),
    ]);

    const paymentTerms = settings?.default_payment_terms ?? 30;
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + paymentTerms);

    const invoiceDate = localDateString(today);
    const dueDateStr = localDateString(dueDate);

    // Build invoice line items
    const lineItems = [
      {
        description: opp.name + (opp.description ? ` - ${opp.description}` : ''),
        quantity: 1,
        unit_price: opp.amount ?? 0,
        account_id: settings?.default_revenue_account_id || null,
        tax_rate_id: null,
      },
    ];

    // Create draft invoice via RPC
    const { data: invoice, error: createErr } = await supabase.rpc('create_invoice_with_links', {
      p_company_id: ctx.companyId,
      p_customer_name: customerName,
      p_customer_email: customerEmail || undefined,
      p_customer_address: customerAddress || undefined,
      p_invoice_date: invoiceDate,
      p_due_date: dueDateStr,
      p_payment_terms: paymentTerms,
      p_currency: opp.currency || company?.base_currency || 'USD',
      p_exchange_rate: 1.0,
      p_notes: `Invoice for opportunity: ${opp.name}`,
      p_footer: '',
      p_organization_id: organizationId ?? undefined,
      p_contact_id: contactId ?? undefined,
      p_project_id: opp.project_id ?? undefined,
      p_lines: JSON.stringify(lineItems),
      p_opportunity_id: opp.id,
    });

    if (createErr) {
      console.error('Error creating invoice from opportunity:', createErr);
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }

    return NextResponse.json({ data: { invoice_id: invoice } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error creating invoice from opportunity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
