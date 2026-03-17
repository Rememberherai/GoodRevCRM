import { useQuery } from '@tanstack/react-query';
import type { ReportSchema } from '@/lib/reports/types';

export function useReportSchema(projectSlug: string) {
  return useQuery<ReportSchema>({
    queryKey: ['report-schema', projectSlug],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectSlug}/reports/schema`);
      if (!res.ok) {
        throw new Error('Failed to load report schema');
      }
      return res.json();
    },
    staleTime: 60_000, // Cache for 1 minute
    gcTime: 300_000,
  });
}
