import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthProvider } from '@/providers/auth-provider';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { MobileSidebar } from '@/components/layout/mobile-sidebar';

export const metadata: Metadata = {
  title: {
    template: '%s | Admin | GoodRev',
    default: 'Admin | GoodRev',
  },
};

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check system admin status via admin client (bypasses RLS)
  const adminClient = createAdminClient();
  const { data: dbUser } = await adminClient
    .from('users')
    .select('is_system_admin, full_name, email')
    .eq('id', user.id)
    .single();

  if (!dbUser?.is_system_admin) {
    redirect('/projects');
  }

  return (
    <AuthProvider>
      <div className="flex h-screen bg-background">
        <AdminSidebar
          adminName={dbUser.full_name ?? user.user_metadata?.full_name ?? 'Admin'}
          adminEmail={dbUser.email ?? user.email ?? ''}
        />
        <MobileSidebar>
          <AdminSidebar
            adminName={dbUser.full_name ?? user.user_metadata?.full_name ?? 'Admin'}
            adminEmail={dbUser.email ?? user.email ?? ''}
            className="flex w-full border-r-0"
          />
        </MobileSidebar>
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          {children}
        </div>
      </div>
    </AuthProvider>
  );
}
