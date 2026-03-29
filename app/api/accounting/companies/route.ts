import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/accounting/companies
// List all accounting companies the current user is a member of.
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: memberships, error } = await supabase
      .from('accounting_company_memberships')
      .select('company_id, role, created_at, accounting_companies(id, name, base_currency, fiscal_year_start_month)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching accounting companies:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Also include the currently selected company ID so the UI can highlight it
    const { data: settings } = await supabase
      .from('user_settings')
      .select('selected_accounting_company_id')
      .eq('user_id', user.id)
      .maybeSingle();

    return NextResponse.json({
      companies: (memberships ?? [])
        .filter((m) => m.accounting_companies != null)
        .map((m) => ({
          ...(m.accounting_companies as object),
          role: m.role,
          joined_at: m.created_at,
        })),
      selected_company_id: settings?.selected_accounting_company_id ?? null,
    });
  } catch (error) {
    console.error('Error listing accounting companies:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
