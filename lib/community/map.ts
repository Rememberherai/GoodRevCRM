export interface CommunityMapPointBase {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface HouseholdMapPoint extends CommunityMapPointBase {
  type: 'household';
  addressLabel: string | null;
  householdSize: number | null;
}

export interface CommunityAssetMapPoint extends CommunityMapPointBase {
  type: 'asset';
  category: string;
  condition: string;
  addressLabel: string | null;
}

export interface ProgramMapPoint extends CommunityMapPointBase {
  type: 'program';
  status: string;
  locationName: string | null;
}

export interface OrganizationMapPoint extends CommunityMapPointBase {
  type: 'organization';
  isReferralPartner: boolean;
  addressLabel: string | null;
}

export type CommunityMapPoint =
  | HouseholdMapPoint
  | CommunityAssetMapPoint
  | ProgramMapPoint
  | OrganizationMapPoint;

export interface CommunityMapData {
  center: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
  households: HouseholdMapPoint[];
  assets: CommunityAssetMapPoint[];
  programs: ProgramMapPoint[];
  organizations: OrganizationMapPoint[];
}

export interface MapCluster<T extends CommunityMapPoint> {
  id: string;
  latitude: number;
  longitude: number;
  items: T[];
  isCluster: boolean;
}

export function buildAddressLabel(parts: Array<string | null | undefined>): string | null {
  const label = parts.filter(Boolean).join(', ').trim();
  return label.length > 0 ? label : null;
}

export function computeMapCenter(
  groups: Array<Array<{ latitude: number; longitude: number }>>,
  fallback?: Partial<{ latitude: number; longitude: number; zoom: number }>
) {
  const points = groups.flat().filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  if (points.length === 0) {
    return {
      latitude: fallback?.latitude ?? 39.7392,
      longitude: fallback?.longitude ?? -104.9903,
      zoom: fallback?.zoom ?? 10,
    };
  }

  const latitude = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const longitude = points.reduce((sum, point) => sum + point.longitude, 0) / points.length;

  return {
    latitude,
    longitude,
    zoom: fallback?.zoom ?? (points.length > 20 ? 11 : 12),
  };
}

function getGridPrecision(zoom: number) {
  if (zoom <= 8) return 1;
  if (zoom <= 10) return 2;
  if (zoom <= 12) return 3;
  if (zoom <= 14) return 4;
  return 5;
}

export function clusterMapPoints<T extends CommunityMapPoint>(
  points: T[],
  zoom: number
): MapCluster<T>[] {
  const precision = getGridPrecision(zoom);
  const grouped = new Map<string, T[]>();

  for (const point of points) {
    const key = `${point.latitude.toFixed(precision)}:${point.longitude.toFixed(precision)}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.push(point);
    } else {
      grouped.set(key, [point]);
    }
  }

  return Array.from(grouped.entries()).map(([key, items]) => {
    const latitude = items.reduce((sum, item) => sum + item.latitude, 0) / items.length;
    const longitude = items.reduce((sum, item) => sum + item.longitude, 0) / items.length;
    return {
      id: key,
      latitude,
      longitude,
      items,
      isCluster: items.length > 1,
    };
  });
}
