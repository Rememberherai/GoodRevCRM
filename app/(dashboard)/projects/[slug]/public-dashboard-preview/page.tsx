import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PublicDashboardView } from '@/components/community/public-dashboard/public-dashboard-view';
import { SAMPLE_DASHBOARD_CONFIG, SAMPLE_DASHBOARD_DATA } from '@/lib/community/public-dashboard-sample-data';

interface PreviewPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublicDashboardPreviewPage({ params }: PreviewPageProps) {
  const { slug } = await params;

  return (
    <div className="-mx-6 -mt-6">
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b bg-amber-50 px-6 py-3">
        <Link
          href={`/projects/${slug}`}
          className="flex items-center gap-2 text-sm font-medium text-amber-800 hover:text-amber-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="h-4 border-l border-amber-300" />
        <p className="text-sm text-amber-700">
          Sample Preview — This dashboard uses demo data to showcase all widget types.
        </p>
      </div>

      <PublicDashboardView config={SAMPLE_DASHBOARD_CONFIG} data={SAMPLE_DASHBOARD_DATA} />
    </div>
  );
}
