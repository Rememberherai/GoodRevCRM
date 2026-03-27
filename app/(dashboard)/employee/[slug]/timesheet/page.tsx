import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmployeeTimesheetClient } from '@/components/community/employees/employee-timesheet-client';

interface TimesheetPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EmployeeTimesheetPage({ params }: TimesheetPageProps) {
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

  // Resolve employee person record for this user in this project
  const { data: person } = await supabase
    .from('people')
    .select('id, first_name, last_name')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .eq('is_employee', true)
    .maybeSingle();

  if (!person) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Timesheet Not Available</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Your account isn&apos;t linked to an employee profile yet. Contact your project admin to get set up.
        </CardContent>
      </Card>
    );
  }

  return (
    <EmployeeTimesheetClient
      projectSlug={slug}
      employeePersonId={person.id}
      employeeName={[person.first_name, person.last_name].filter(Boolean).join(' ')}
    />
  );
}
