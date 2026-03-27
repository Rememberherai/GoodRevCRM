'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PublicResourceHub } from '@/components/resources/public-resource-hub';

interface HubData {
  hub: {
    title: string;
    description: string | null;
    logo_url: string | null;
    accent_color: string | null;
  };
  assets: {
    id: string;
    name: string;
    description: string | null;
    access_mode: string;
    resource_slug: string;
    approval_policy: string;
    concurrent_capacity: number;
    return_required: boolean;
  }[];
}

export default function ResourceHubPage() {
  const params = useParams();
  const hubSlug = params.hubSlug as string;
  const [data, setData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/resources/${hubSlug}`);
        if (!res.ok) {
          setError('Resource hub not found');
          return;
        }
        const json = await res.json() as HubData;
        setData(json);
      } catch {
        setError('Failed to load resources');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [hubSlug]);

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
        <p className="mt-2 text-muted-foreground">{error || 'Resource hub not found'}</p>
      </div>
    );
  }

  return <PublicResourceHub hub={data.hub} assets={data.assets} hubSlug={hubSlug} />;
}
