import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CalendarShell } from './calendar-shell';
import type { CalendarProfile } from '@/types/calendar';

export default async function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch calendar profile
  const { data: profile } = await supabase
    .from('calendar_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  // Fetch user's projects for the project selector
  const { data: memberships } = await supabase
    .from('project_memberships')
    .select('project_id, projects(id, name, slug)')
    .eq('user_id', user.id)
    .limit(50);

  const projects = (memberships || [])
    .map((m) => m.projects)
    .filter(Boolean) as { id: string; name: string; slug: string }[];

  return (
    <CalendarShell
      profile={profile as CalendarProfile | null}
      projects={projects}
    >
      {children}
    </CalendarShell>
  );
}
