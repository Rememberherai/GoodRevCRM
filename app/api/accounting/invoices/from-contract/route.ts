import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAccountingContext, hasMinRole } from '@/lib/accounting/helpers';
import { z } from 'zod';

const schema = z.object({
  contract_id: z.string().uuid(),
  project_slug: z.string(),
  amount: z.number().positive(),
  description: z.string().optional(),
});

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// POST /api/accounting/invoices/from-contract
// Creates a draft invoice pre-filled from a completed contract
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getAccountingContext(supabase);

    if (!ctx || !hasMinRole(ctx.role, 'member')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contract_id, project_slug, amount, description } = schema.parse(body);

    // Resolve project_id from slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', project_slug)
      .is('deleted_at', null)
      .maybeSingle();

    if (projectError) {
      console.error('Error resolving project for contract invoice:', projectError);
      return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project_id = project.id;

    // Fetch the contract with related data
    const { data: contract, error: contractErr } = await supabase
      .from('contract_documents')
      .select('id, title, status, organization_id, person_id, opportunity_id, project_id')
      .eq('id', contract_id)
      .single();

    if (contractErr || !contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    if (contract.status !== 'completed') {
      return NextResponse.json(
        { error: 'Can only create invoices from completed contracts' },
        { status: 400 },
      );
    }

    if (contract.project_id !== project_id) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from('project_memberships')
      .select('user_id')
      .eq('project_id', project_id)
      .eq('user_id', ctx.userId)
      .maybeSingle();

    if (membershipError) {
      console.error('Error checking project membership for contract invoice:', membershipError);
      return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
    }

    if (!membership) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Fetch organization details for customer snapshot
    let customerName = contract.title;
    let customerEmail = '';
    let customerAddress = '';
    const organizationId: string | null = contract.organization_id;
    const contactId: string | null = contract.person_id;

    if (contract.organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name, address_street, address_city, address_state, address_postal_code, address_country')
        .eq('id', contract.organization_id)
        .single();

      if (org) {
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

    // If we have a person but no org name from org, get person info
    if (!contract.organization_id && contract.person_id) {
      const { data: person } = await supabase
        .from('people')
        .select('first_name, last_name, email')
        .eq('id', contract.person_id)
        .single();

      if (person) {
        customerName = `${person.first_name} ${person.last_name}`.trim();
        customerEmail = person.email || '';
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

    let invoiceCurrency = company?.base_currency ?? 'USD';

    if (contract.opportunity_id) {
      const { data: linkedOpportunity } = await supabase
        .from('opportunities')
        .select('currency')
        .eq('id', contract.opportunity_id)
        .maybeSingle();

      if (linkedOpportunity?.currency) {
        invoiceCurrency = linkedOpportunity.currency;
      }
    }

    const paymentTerms = settings?.default_payment_terms ?? 30;
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + paymentTerms);

    const invoiceDate = localDateString(today);
    const dueDateStr = localDateString(dueDate);

    const lineItems = [
      {
        description: description || contract.title,
        quantity: 1,
        unit_price: amount,
        account_id: settings?.default_revenue_account_id || null,
        tax_rate_id: null,
      },
    ];

    const { data: invoice, error: createErr } = await supabase.rpc('create_invoice_with_links', {
      p_company_id: ctx.companyId,
      p_customer_name: customerName,
      p_customer_email: customerEmail || undefined,
      p_customer_address: customerAddress || undefined,
      p_invoice_date: invoiceDate,
      p_due_date: dueDateStr,
      p_payment_terms: paymentTerms,
      p_currency: invoiceCurrency,
      p_exchange_rate: 1.0,
      p_notes: `Invoice for contract: ${contract.title}`,
      p_footer: '',
      p_organization_id: organizationId ?? undefined,
      p_contact_id: contactId ?? undefined,
      p_project_id: project_id ?? undefined,
      p_lines: lineItems,
      p_opportunity_id: contract.opportunity_id ?? undefined,
      p_contract_id: contract.id,
    });

    if (createErr) {
      console.error('Error creating invoice from contract:', createErr);
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }

    return NextResponse.json({ data: { invoice_id: invoice } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error creating invoice from contract:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
