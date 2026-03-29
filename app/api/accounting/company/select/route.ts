import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  company_id: z.string().uuid(),
});

// PUT /api/accounting/company/select
// Set the user's active accounting company.
// The company_id must be one the user is already a member of.
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { company_id } = schema.parse(body);

    // Verify user is actually a member of the requested company
    const { data: membership } = await supabase
      .from('accounting_company_memberships')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('company_id', company_id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Company not found or not accessible' }, { status: 404 });
    }

    // Upsert the preference into user_settings
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        { user_id: user.id, selected_accounting_company_id: company_id },
        { onConflict: 'user_id' },
      );

    if (error) {
      console.error('Error saving company selection:', error);
      return NextResponse.json({ error: 'Failed to save selection' }, { status: 500 });
    }

    return NextResponse.json({ company_id, role: membership.role });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Error selecting accounting company:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
