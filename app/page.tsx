import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LAST_PROJECT_SLUG_COOKIE } from '@/lib/project-navigation';

export default async function Home() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const lastProjectSlug = cookieStore.get(LAST_PROJECT_SLUG_COOKIE)?.value ?? null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  if (lastProjectSlug) {
    const { data: lastProject } = await supabase
      .from('projects')
      .select('slug')
      .eq('slug', lastProjectSlug)
      .is('deleted_at', null)
      .maybeSingle();

    if (lastProject?.slug) {
      redirect(`/projects/${lastProject.slug}`);
    }
  }

  redirect('/projects');
}
