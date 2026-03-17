import { createClient } from '@/lib/supabase/server';
import { ReportBuilder } from '@/components/reports/builder/report-builder';

interface BuilderPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ edit?: string }>;
}

export default async function ReportBuilderPage({ params, searchParams }: BuilderPageProps) {
  const { slug } = await params;
  const { edit } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">Please sign in.</div>;
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <ReportBuilder projectSlug={slug} editReportId={edit} />
    </div>
  );
}
