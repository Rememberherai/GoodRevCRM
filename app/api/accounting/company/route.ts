import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createCompanySchema = z.object({
  name: z.string().min(1).max(255),
  base_currency: z.string().length(3).default('USD'),
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

    const { data: membership } = await supabase
      .from('accounting_company_memberships')
      .select('company_id, role, accounting_companies(*)')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership?.accounting_companies) {
      return NextResponse.json({ company: null });
    }

    return NextResponse.json({ company: membership.accounting_companies, role: membership.role });
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

    // Check if user already has a company
    const { data: existing } = await supabase
      .from('accounting_company_memberships')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'You already have an accounting company' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = createCompanySchema.parse(body);

    // Create the company (trigger auto-creates owner membership)
    const { data: company, error: companyError } = await supabase
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
    const { error: settingsError } = await supabase
      .from('accounting_settings')
      .insert({
        company_id: company.id,
      });

    if (settingsError) {
      console.error('Error creating accounting settings:', settingsError);
    }

    // Seed default chart of accounts will happen in Phase 1
    // For now, just return the created company

    return NextResponse.json({ company }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error creating accounting company:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
