import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getAccountingMembershipWithCompanyForUser } from '@/lib/accounting/helpers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createCompanySchema = z.object({
  name: z.string().trim().min(1).max(255),
  base_currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default('USD'),
  fiscal_year_start_month: z.number().int().min(1).max(12).default(1),
});

// GET /api/accounting/company - Get user's accounting company
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membership = await getAccountingMembershipWithCompanyForUser(supabase, user.id);

    if (!membership?.company) {
      return NextResponse.json({ company: null });
    }

    return NextResponse.json({ company: membership.company, role: membership.role });
  } catch (error) {
    console.error('Error fetching accounting company:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounting/company - Create accounting company + seed defaults
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createCompanySchema.parse(body);

    // Use service client for company creation to bypass RLS.
    // We've already verified the user's identity via auth.getUser() above.
    // The regular client's auth.uid() may not propagate to RLS context
    // in all deployment environments (e.g. Vercel edge).
    const serviceClient = createServiceClient();

    // Create the company (trigger auto-creates owner membership)
    const { data: company, error: companyError } = await serviceClient
      .from('accounting_companies')
      .insert({
        name: parsed.name,
        base_currency: parsed.base_currency,
        fiscal_year_start_month: parsed.fiscal_year_start_month,
        created_by: user.id,
      })
      .select()
      .single();

    if (companyError || !company) {
      console.error('Error creating accounting company:', companyError);
      return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
    }

    // Create default accounting settings
    const { error: settingsError } = await serviceClient
      .from('accounting_settings')
      .insert({
        company_id: company.id,
      });

    if (settingsError) {
      console.error('Error creating accounting settings:', settingsError);
      await serviceClient.from('accounting_companies').delete().eq('id', company.id);
      return NextResponse.json({ error: 'Failed to initialize accounting company' }, { status: 500 });
    }

    // Seed default chart of accounts and update settings with default account references
    const { error: seedError } = await serviceClient.rpc('seed_default_accounts', {
      p_company_id: company.id,
    });

    if (seedError) {
      console.error('Error seeding default accounts:', seedError);
      // Clean up both settings and company — settings has no cascade from companies
      await serviceClient.from('accounting_settings').delete().eq('company_id', company.id);
      await serviceClient.from('accounting_companies').delete().eq('id', company.id);
      return NextResponse.json({ error: 'Failed to initialize accounting company' }, { status: 500 });
    }

    const { error: selectionError } = await serviceClient
      .from('user_settings')
      .upsert(
        { user_id: user.id, selected_accounting_company_id: company.id },
        { onConflict: 'user_id' },
      );

    if (selectionError) {
      console.error('Error selecting newly created accounting company:', selectionError);
    }

    return NextResponse.json({ company }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error creating accounting company:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
