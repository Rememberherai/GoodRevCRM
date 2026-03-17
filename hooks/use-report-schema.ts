import * as React from 'react';
import type { ReportSchema } from '@/lib/reports/types';

export function useReportSchema(projectSlug: string) {
  const [data, setData] = React.useState<ReportSchema | undefined>(undefined);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`/api/projects/${projectSlug}/reports/schema`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load report schema');
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to load report schema'));
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [projectSlug]);

  return { data, isLoading, error };
}
