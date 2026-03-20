import { buildAddressLabel } from '@/lib/community/map';

export interface GeocodeAddressInput {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

export function formatGeocodeAddress(input: GeocodeAddressInput) {
  return buildAddressLabel([
    input.street,
    input.city,
    input.state,
    input.postalCode,
    input.country,
  ]);
}

export async function geocodeAddress(input: GeocodeAddressInput): Promise<GeocodeResult | null> {
  const query = formatGeocodeAddress(input);
  if (!query) {
    return null;
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'GoodRevCRM/1.0 (community geocoding)',
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error(`Geocoding request failed with status ${response.status}`);
  }

  const results = await response.json() as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const first = results[0];
  if (!first) {
    return null;
  }

  return {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
    displayName: first.display_name,
  };
}
