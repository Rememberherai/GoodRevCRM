import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContractorTimesheetClient } from '@/components/community/contractors/contractor-timesheet-client';

interface TimesheetPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ContractorTimesheetPage({ params }: TimesheetPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, slug')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();
  if (!project) notFound();

  // Resolve contractor person record for this user in this project
  const { data: person } = await supabase
    .from('people')
    .select('id')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!person) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Timesheet Not Available</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Your account isn&apos;t linked to a contractor profile yet. Contact your project admin to get set up.
        </CardContent>
      </Card>
    );
  }

  return (
    <ContractorTimesheetClient
      projectSlug={slug}
      contractorPersonId={person.id}
    />
  );
}
