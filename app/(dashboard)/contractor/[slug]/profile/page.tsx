import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ContractorProfilePageProps {
  params: Promise<{ slug: string }>;
}

export default async function ContractorProfilePage({ params }: ContractorProfilePageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, slug')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) {
    redirect('/projects');
  }

  const { data: membership } = await supabase
    .from('project_memberships')
    .select('role')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .single();

  if (membership?.role !== 'contractor') {
    redirect(`/projects/${slug}`);
  }

  const { data: person } = await adminSupabase
    .from('people')
    .select('id, first_name, last_name, email, phone, user_id')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  const { data: scopes } = person
    ? await adminSupabase
        .from('contractor_scopes')
        .select('id, title, status, document_url')
        .eq('project_id', project.id)
        .eq('contractor_id', person.id)
        .order('created_at', { ascending: false })
    : { data: [] };

  const { data: integrations } = await adminSupabase
    .from('calendar_integrations')
    .select('id, provider, status, email')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .order('created_at', { ascending: false })
    .limit(1);

  const calendarIntegration = integrations?.[0] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
        <p className="text-sm text-muted-foreground">Manage your contractor record, scope documents, and Google Calendar connection.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contractor Record</CardTitle>
            <CardDescription>Your linked project person record.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {person ? (
              <>
                <div><span className="font-medium">Name:</span> {[person.first_name, person.last_name].filter(Boolean).join(' ') || 'Not set'}</div>
                <div><span className="font-medium">Email:</span> {person.email || 'Not set'}</div>
                <div><span className="font-medium">Phone:</span> {person.phone || 'Not set'}</div>
                <div><span className="font-medium">Linked:</span> <Badge variant="outline">Connected to your login</Badge></div>
              </>
            ) : (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                Your contractor account is not linked to a person record yet. Ask an admin to finish contractor onboarding.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Google Calendar</CardTitle>
            <CardDescription>Connect your calendar so assignments and deadlines sync automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {calendarIntegration ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{calendarIntegration.status}</Badge>
                  <span>{calendarIntegration.email || 'Google Calendar connected'}</span>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/api/calendar/integrations/google/connect">Reconnect Google Calendar</Link>
                </Button>
              </>
            ) : (
              <>
                <div className="text-muted-foreground">No Google Calendar connection yet.</div>
                <Button asChild>
                  <Link href="/api/calendar/integrations/google/connect">Connect Google Calendar</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scope Documents</CardTitle>
          <CardDescription>Your current scope of work and related onboarding documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(scopes ?? []).length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No scope documents have been shared yet.
            </div>
          ) : (
            (scopes ?? []).map((scope) => (
              <div key={scope.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{scope.title}</div>
                  <Badge variant="secondary">{(scope.status ?? 'unknown').replace(/_/g, ' ')}</Badge>
                </div>
                {scope.document_url && (
                  <div className="mt-3">
                    <a href={scope.document_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                      Open document
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
