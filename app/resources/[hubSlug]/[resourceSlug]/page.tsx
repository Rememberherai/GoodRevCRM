'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PublicResourceDetail } from '@/components/resources/public-resource-detail';

interface AssetData {
  asset: {
    id: string;
    name: string;
    description: string | null;
    access_mode: string;
    approval_policy: string;
    concurrent_capacity: number;
    return_required: boolean;
    access_instructions: string | null;
  };
  presets: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    duration_minutes: number;
    custom_questions: unknown;
  }[];
  timezone: string;
}

export default function ResourceDetailPage() {
  const params = useParams();
  const hubSlug = params.hubSlug as string;
  const resourceSlug = params.resourceSlug as string;
  const [data, setData] = useState<AssetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/resources/${hubSlug}/${resourceSlug}`);
        if (!res.ok) {
          setError('Resource not found');
          return;
        }
        const json = await res.json() as AssetData;
        setData(json);
      } catch {
        setError('Failed to load resource');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [hubSlug, resourceSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Not Found</h1>
        <p className="mt-2 text-muted-foreground">{error || 'Resource not found'}</p>
      </div>
    );
  }

  return (
    <PublicResourceDetail
      asset={data.asset}
      presets={data.presets}
      timezone={data.timezone}
      hubSlug={hubSlug}
      resourceSlug={resourceSlug}
    />
  );
}
