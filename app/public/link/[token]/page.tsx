import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublicDashboardAggregateData } from '@/lib/community/public-dashboard-queries';
import { isExpiredTimestamp } from '@/lib/community/public-dashboard-auth';
import { PublicDashboardView } from '@/components/community/public-dashboard/public-dashboard-view';
import type { PublicDashboardAggregateData } from '@/lib/community/public-dashboard-queries';

interface ShareLinkPageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicDashboardShareLinkPage({ params }: ShareLinkPageProps) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: shareLink } = await admin
    .from('public_dashboard_share_links')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle();

  if (!shareLink) notFound();
  if (isExpiredTimestamp(shareLink.expires_at)) notFound();

  const { data: config } = await admin
    .from('public_dashboard_configs')
    .select('*')
    .eq('id', shareLink.config_id)
    .neq('status', 'archived')
    .maybeSingle();

  if (!config) notFound();

  await admin
    .from('public_dashboard_share_links')
    .update({
      access_count: (shareLink.access_count ?? 0) + 1,
      last_accessed_at: new Date().toISOString(),
    })
    .eq('id', shareLink.id);

  const data = (config.data_freshness === 'snapshot' && config.snapshot_data
    ? config.snapshot_data
    : await getPublicDashboardAggregateData(config)) as PublicDashboardAggregateData;

  return <PublicDashboardView config={config} data={data} />;
}
