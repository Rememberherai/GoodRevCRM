import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getAdminStats, getActiveSessions, getRecentAdminActions } from '@/lib/admin/queries';
import { AdminDashboardClient } from '@/components/admin/admin-dashboard-client';

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [stats, sessions, recentActions] = await Promise.all([
    getAdminStats(),
    getActiveSessions(user.id),
    getRecentAdminActions(20),
  ]);

  return (
    <AdminDashboardClient
      stats={stats}
      sessions={sessions}
      recentActions={recentActions}
    />
  );
}
