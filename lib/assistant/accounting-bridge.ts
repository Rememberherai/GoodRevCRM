import { createAdminClient } from '@/lib/supabase/admin';
import { createQBBill } from './quickbooks';

interface ReceiptAccountingInput {
  projectId: string;
  userId: string;
  vendor: string;
  amount: number;
  receiptDate: string;
  description: string | null;
  accountCode?: string | null;
  className?: string | null;
  imageUrl?: string | null;
}

function toIsoDate(input: string) {
  // Handle both ISO "2026-02-14" and natural "Feb 14, 2026" formats
  const d = new Date(input);
  if (isNaN(d.getTime())) return input.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

async function ensureAccountingCompany(projectId: string, userId: string, projectName: string) {
  const admin = createAdminClient();

  const { data: project } = await admin
    .from('projects')
    .select('accounting_company_id')
    .eq('id', projectId)
    .single();

  if (project?.accounting_company_id) {
    return project.accounting_company_id;
  }

  const { data: membership } = await admin
    .from('accounting_company_memberships')
    .select('company_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  let companyId = membership?.company_id ?? null;

  if (!companyId) {
    const { data: company, error: companyError } = await admin
      .from('accounting_companies')
      .insert({
        name: `${projectName} Accounting`,
        created_by: userId,
        base_currency: 'USD',
        fiscal_year_start_month: 1,
      })
      .select('id')
      .single();

    if (companyError || !company) {
      throw new Error('Failed to create linked GoodRev accounting company');
    }

    companyId = company.id;

    const { error: settingsError } = await admin
      .from('accounting_settings')
      .insert({ company_id: companyId });
    if (settingsError) {
      throw new Error('Failed to initialize accounting settings');
    }

    const { error: seedError } = await admin.rpc('seed_default_accounts', { p_company_id: companyId });
    if (seedError) {
      throw new Error('Failed to seed default accounting accounts');
    }
  }

  const { error: projectUpdateError } = await admin
    .from('projects')
    .update({ accounting_company_id: companyId })
    .eq('id', projectId);

  if (projectUpdateError) {
    throw new Error('Failed to link project to accounting company');
  }

  return companyId;
}

async function resolveExpenseAccount(companyId: string, accountCode?: string | null) {
  const admin = createAdminClient();

  if (accountCode) {
    const { data: exact } = await admin
      .from('chart_of_accounts')
      .select('id')
      .eq('company_id', companyId)
      .eq('account_code', accountCode)
      .eq('account_type', 'expense')
      .is('deleted_at', null)
      .eq('is_active', true)
      .maybeSingle();

    if (exact?.id) {
      return exact.id;
    }
  }

  const { data: fallback } = await admin
    .from('chart_of_accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('account_type', 'expense')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('account_code', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!fallback?.id) {
    throw new Error('No active expense account is available for the linked accounting company');
  }

  return fallback.id;
}

async function createGoodRevBill(params: ReceiptAccountingInput) {
  const admin = createAdminClient();
  const { data: project } = await admin
    .from('projects')
    .select('name')
    .eq('id', params.projectId)
    .single();

  // BUG-F: Verify the calling user is a project member (not viewer) before creating a bill
  const { data: projectMembership } = await admin
    .from('project_memberships')
    .select('role')
    .eq('project_id', params.projectId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (!projectMembership || projectMembership.role === 'viewer') {
    throw new Error('Insufficient permissions to create a bill for this project');
  }

  const companyId = await ensureAccountingCompany(params.projectId, params.userId, project?.name ?? 'Community Project');
  const accountId = await resolveExpenseAccount(companyId, params.accountCode);

  const { data: billId, error } = await admin.rpc('create_bill', {
    p_company_id: companyId,
    p_vendor_name: params.vendor,
    p_bill_date: toIsoDate(params.receiptDate),
    p_due_date: toIsoDate(params.receiptDate),
    p_lines: [
      {
        description: params.description ?? params.vendor,
        quantity: 1,
        unit_price: params.amount,
        account_id: accountId,
      },
    ],
    p_project_id: params.projectId,
    p_currency: 'USD',
    p_exchange_rate: 1,
    p_notes: params.imageUrl
      ? `Receipt image: ${params.imageUrl}${params.className ? `\nClass: ${params.className}` : ''}`
      : params.className
        ? `Class: ${params.className}`
        : undefined,
    p_created_by: params.userId,
  });

  if (error || !billId) {
    throw new Error(error?.message ?? 'Failed to create GoodRev bill');
  }

  return {
    provider: 'goodrev' as const,
    externalBillId: billId,
  };
}

export async function createBill(params: ReceiptAccountingInput) {
  const admin = createAdminClient();
  const { data: project } = await admin
    .from('projects')
    .select('accounting_target')
    .eq('id', params.projectId)
    .single();

  const target = project?.accounting_target;
  if (!target || target === 'none') {
    throw new Error('This project does not have an accounting target configured');
  }

  if (target === 'quickbooks') {
    const result = await createQBBill({
      projectId: params.projectId,
      vendor: params.vendor,
      amount: params.amount,
      receiptDate: toIsoDate(params.receiptDate),
      description: params.description,
      accountCode: params.accountCode,
      className: params.className,
      imageUrl: params.imageUrl,
    });

    return {
      provider: 'quickbooks' as const,
      externalBillId: result.id,
      raw: result.raw,
    };
  }

  return createGoodRevBill(params);
}

