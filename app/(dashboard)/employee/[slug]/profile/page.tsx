import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProfilePageProps {
  params: Promise<{ slug: string }>;
}

export default async function EmployeeProfilePage({ params }: ProfilePageProps) {
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

  const { data: person } = await supabase
    .from('people')
    .select('id, first_name, last_name, email, phone, mobile_phone, job_title')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .eq('is_employee', true)
    .maybeSingle();

  if (!person) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Profile Not Available</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Your account isn&apos;t linked to an employee profile yet. Contact your project admin to get set up.
        </CardContent>
      </Card>
    );
  }

  const displayName = [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Employee';

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-2xl font-bold tracking-tight">{displayName}</h2>
        {person.job_title && (
          <p className="mt-1 text-muted-foreground">{person.job_title}</p>
        )}
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            {person.email && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{person.email}</dd>
              </div>
            )}
            {person.phone && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="font-medium">{person.phone}</dd>
              </div>
            )}
            {person.mobile_phone && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Mobile</dt>
                <dd className="font-medium">{person.mobile_phone}</dd>
              </div>
            )}
            {!person.email && !person.phone && !person.mobile_phone && (
              <p className="text-muted-foreground">No contact information on file.</p>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
