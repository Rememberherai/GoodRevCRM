'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Clock, Key, ChevronRight, BookOpen, TrendingUp, Package } from 'lucide-react';

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
  booking_count: number;
}

interface CurrentLoan {
  id: string;
  borrower_name: string;
  start_at: string;
  end_at: string;
  asset_name: string;
  resource_slug: string | null;
}

interface PopularResource {
  id: string;
  name: string;
  resource_slug: string | null;
  booking_count: number;
}

const MODE_LABELS: Record<string, string> = {
  reservable: 'Reservable',
  loanable: 'Loanable',
  hybrid: 'Reservable & Loanable',
};

const MODE_STYLES: Record<string, string> = {
  reservable: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  loanable: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  hybrid: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
};

const POLICY_LABELS: Record<string, string> = {
  open_auto: 'Instant confirmation',
  open_review: 'Requires approval',
  approved_only: 'Pre-approval required',
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Due soon';
  if (diffHours < 24) return `Due in ${diffHours}h`;
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays}d`;
}

export function PublicResourceHub({
  hub,
  assets,
  hubSlug,
  currentLoans,
  popularResources,
}: {
  hub: HubInfo;
  assets: AssetInfo[];
  hubSlug: string;
  currentLoans: CurrentLoan[];
  popularResources: PopularResource[];
}) {
  const accentColor = hub.accent_color ?? '#3b82f6';

  return (
    <div>
      {/* Hero header */}
      <div
        className="relative mb-10 overflow-hidden rounded-2xl px-8 py-12"
        style={{
          background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}08)`,
          borderBottom: `3px solid ${accentColor}30`,
        }}
      >
        <div className="mx-auto max-w-3xl text-center">
          {hub.logo_url && (
            <Image
              src={hub.logo_url}
              alt={hub.title}
              width={80}
              height={80}
              className="mx-auto mb-5 h-20 w-20 rounded-2xl object-cover shadow-md"
              unoptimized
            />
          )}
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {hub.title}
          </h1>
          {hub.description && (
            <p className="mx-auto mt-3 max-w-xl text-lg text-gray-600 dark:text-gray-400">
              {hub.description}
            </p>
          )}
          <div className="mt-5 flex items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <Package className="h-4 w-4" />
              {assets.length} {assets.length === 1 ? 'resource' : 'resources'} available
            </span>
            {currentLoans.length > 0 && (
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                {currentLoans.length} currently checked out
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main content with sidebar layout */}
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Resource grid — main content */}
        <div className="flex-1">
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
                  className="group flex flex-col rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 dark:bg-gray-900"
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
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${MODE_STYLES[asset.access_mode] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
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

        {/* Sidebar */}
        <div className="w-full space-y-6 lg:w-72 lg:shrink-0">
          {/* Currently Borrowed / On Loan */}
          <div className="rounded-xl border bg-white p-5 dark:bg-gray-900">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <BookOpen className="h-4 w-4" style={{ color: accentColor }} />
              Currently Checked Out
            </h3>
            {currentLoans.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing currently checked out.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {currentLoans.map((loan) => (
                  <div key={loan.id} className="border-l-2 pl-3" style={{ borderColor: accentColor }}>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {loan.asset_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {loan.borrower_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatRelativeTime(loan.end_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Most Popular Resources */}
          <div className="rounded-xl border bg-white p-5 dark:bg-gray-900">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <TrendingUp className="h-4 w-4" style={{ color: accentColor }} />
              Most Popular
            </h3>
            {popularResources.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No booking history yet.
              </p>
            ) : (
              <ol className="mt-3 space-y-2">
                {popularResources.map((resource, index) => (
                  <li key={resource.id}>
                    <Link
                      href={resource.resource_slug ? `/resources/${hubSlug}/${resource.resource_slug}` : '#'}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: accentColor }}
                      >
                        {index + 1}
                      </span>
                      <span className="flex-1 truncate text-gray-900 dark:text-gray-100">
                        {resource.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {resource.booking_count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
