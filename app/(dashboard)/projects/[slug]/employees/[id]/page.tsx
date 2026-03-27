import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Skeleton } from '@/components/ui/skeleton';
import { Suspense } from 'react';
import { EmployeeDetailClient } from '@/components/community/employees/employee-detail-client';

interface EmployeeDetailPageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function EmployeeDetailPage({ params }: EmployeeDetailPageProps) {
  const { slug, id } = await params;
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (projectError || !project) notFound();

  const { data: person } = await supabase
    .from('people')
    .select('id, first_name, last_name, email, phone, mobile_phone, job_title, user_id, is_employee, kiosk_pin_hmac')
    .eq('id', id)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!person || !person.is_employee) notFound();

  const { kiosk_pin_hmac, ...personWithoutHmac } = person;

  return (
    <Suspense fallback={<EmployeeDetailSkeleton />}>
      <EmployeeDetailClient
        employeeId={id}
        projectSlug={slug}
        initialPerson={{ ...personWithoutHmac, pin_set: kiosk_pin_hmac != null }}
      />
    </Suspense>
  );
}

function EmployeeDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
