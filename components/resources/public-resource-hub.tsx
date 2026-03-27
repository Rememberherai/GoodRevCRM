'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Clock, Key, ChevronRight } from 'lucide-react';

interface HubInfo {
  title: string;
  description: string | null;
  logo_url: string | null;
  accent_color: string | null;
}

interface AssetInfo {
  id: string;
  name: string;
  description: string | null;
  access_mode: string;
  resource_slug: string;
  approval_policy: string;
  concurrent_capacity: number;
  return_required: boolean;
}

const MODE_LABELS: Record<string, string> = {
  reservable: 'Reservable',
  loanable: 'Loanable',
  hybrid: 'Reservable & Loanable',
};

const POLICY_LABELS: Record<string, string> = {
  open_auto: 'Instant confirmation',
  open_review: 'Requires approval',
  approved_only: 'Pre-approval required',
};

export function PublicResourceHub({
  hub,
  assets,
  hubSlug,
}: {
  hub: HubInfo;
  assets: AssetInfo[];
  hubSlug: string;
}) {
  return (
    <div>
      {/* Hub header */}
      <div className="mb-8 text-center">
        {hub.logo_url && (
          <Image
            src={hub.logo_url}
            alt={hub.title}
            width={64}
            height={64}
            className="mx-auto mb-4 h-16 w-16 rounded-full object-cover"
            unoptimized
          />
        )}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {hub.title}
        </h1>
        {hub.description && (
          <p className="mt-2 text-lg text-muted-foreground">{hub.description}</p>
        )}
      </div>

      {/* Asset grid */}
      {assets.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No resources are currently available.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {assets.map((asset) => (
            <Link
              key={asset.id}
              href={`/resources/${hubSlug}/${asset.resource_slug}`}
              className="group flex flex-col rounded-lg border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 dark:text-gray-100">
                    {asset.name}
                  </h2>
                  {asset.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {asset.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="ml-2 mt-1 h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <Clock className="h-3 w-3" />
                  {MODE_LABELS[asset.access_mode] || asset.access_mode}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <Key className="h-3 w-3" />
                  {POLICY_LABELS[asset.approval_policy] || asset.approval_policy}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
