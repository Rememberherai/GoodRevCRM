import { Suspense } from 'react';
import { PersonDetailClient } from './person-detail-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import type { CompanyContext } from '@/lib/validators/project';

interface PersonDetailPageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function PersonDetailPage({ params }: PersonDetailPageProps) {
  const { slug, id } = await params;
  const supabase = await createClient();

  // Fetch project settings for company context
  const { data: project } = await supabase
    .from('projects')
    .select('settings')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  const settings = project?.settings as { company_context?: CompanyContext } | null;
  const companyContext = settings?.company_context;

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <Suspense fallback={<PersonDetailSkeleton />}>
      <PersonDetailClient personId={id} companyContext={companyContext} currentUserId={user?.id} />
    </Suspense>
  );
}

function PersonDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-40" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-48" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
