'use client';

import Link from 'next/link';
import type { CommunityMapPoint } from '@/lib/community/map';

interface MarkerPopupProps {
  slug: string;
  point: CommunityMapPoint;
}

function getHref(slug: string, point: CommunityMapPoint) {
  switch (point.type) {
    case 'household':
      return `/projects/${slug}/households/${point.id}`;
    case 'asset':
      return `/projects/${slug}/community-assets/${point.id}`;
    case 'program':
      return `/projects/${slug}/programs/${point.id}`;
    case 'organization':
      return `/projects/${slug}/organizations/${point.id}`;
    default:
      return `/projects/${slug}`;
  }
}

export function MarkerPopup({ slug, point }: MarkerPopupProps) {
  return (
    <div className="min-w-56 space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {point.type.replace('_', ' ')}
      </div>
      <div className="text-sm font-semibold">{point.name}</div>
      {'addressLabel' in point && point.addressLabel && (
        <div className="text-xs text-muted-foreground">{point.addressLabel}</div>
      )}
      {'locationName' in point && point.locationName && (
        <div className="text-xs text-muted-foreground">{point.locationName}</div>
      )}
      {'householdSize' in point && point.householdSize !== null && (
        <div className="text-xs text-muted-foreground">Household size: {point.householdSize}</div>
      )}
      {'category' in point && (
        <div className="text-xs text-muted-foreground">
          {point.category} · {point.condition}
        </div>
      )}
      {'status' in point && (
        <div className="text-xs text-muted-foreground">Status: {point.status}</div>
      )}
      {'isReferralPartner' in point && point.isReferralPartner && (
        <div className="text-xs text-muted-foreground">Referral partner</div>
      )}
      <Link href={getHref(slug, point)} className="text-xs font-medium text-primary hover:underline">
        Open details
      </Link>
    </div>
  );
}
