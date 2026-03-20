import { geocodeAddress } from '@/lib/community/geocoding';

interface GeocodeTarget {
  id: string;
  table: 'households' | 'community_assets';
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

interface GeocodeProcessorDeps<T> {
  targets: T[];
  geocode: (target: T) => Promise<{ latitude: number; longitude: number } | null>;
  persist: (target: T, result: { latitude: number; longitude: number } | null) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  intervalMs?: number;
}

export interface CommunityGeocodeRunSummary {
  processed: number;
  succeeded: number;
  failed: number;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function processGeocodeTargets<T>({
  targets,
  geocode,
  persist,
  sleep = wait,
  intervalMs = 1000,
}: GeocodeProcessorDeps<T>): Promise<CommunityGeocodeRunSummary> {
  let succeeded = 0;
  let failed = 0;

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    if (!target) {
      continue;
    }

    if (index > 0) {
      await sleep(intervalMs);
    }

    const result = await geocode(target);
    await persist(target, result);

    if (result) {
      succeeded += 1;
    } else {
      failed += 1;
    }
  }

  return {
    processed: targets.length,
    succeeded,
    failed,
  };
}

export async function processPendingCommunityGeocodes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  limit = 20
) {
  const [householdsResult, assetsResult] = await Promise.all([
    supabase
      .from('households')
      .select('id, address_street, address_city, address_state, address_postal_code, address_country')
      .eq('project_id', projectId)
      .eq('geocoded_status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(limit),
    supabase
      .from('community_assets')
      .select('id, address_street, address_city, address_state, address_postal_code, address_country')
      .eq('project_id', projectId)
      .eq('geocoded_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit),
  ]);

  const targets: GeocodeTarget[] = [
    ...((householdsResult.data ?? []).map((row: {
      id: string;
      address_street: string | null;
      address_city: string | null;
      address_state: string | null;
      address_postal_code: string | null;
      address_country: string | null;
    }) => ({
      id: row.id,
      table: 'households' as const,
      street: row.address_street,
      city: row.address_city,
      state: row.address_state,
      postalCode: row.address_postal_code,
      country: row.address_country,
    }))),
    ...((assetsResult.data ?? []).map((row: {
      id: string;
      address_street: string | null;
      address_city: string | null;
      address_state: string | null;
      address_postal_code: string | null;
      address_country: string | null;
    }) => ({
      id: row.id,
      table: 'community_assets' as const,
      street: row.address_street,
      city: row.address_city,
      state: row.address_state,
      postalCode: row.address_postal_code,
      country: row.address_country,
    }))),
  ].slice(0, limit);

  return processGeocodeTargets<GeocodeTarget>({
    targets,
    geocode: async (target) => geocodeAddress({
      street: target.street,
      city: target.city,
      state: target.state,
      postalCode: target.postalCode,
      country: target.country,
    }),
    persist: async (target, result) => {
      const update = result
        ? {
            latitude: result.latitude,
            longitude: result.longitude,
            geocoded_status: 'success',
          }
        : {
            geocoded_status: 'failed',
          };

      await supabase
        .from(target.table)
        .update(update)
        .eq('id', target.id)
        .eq('project_id', projectId);
    },
  });
}
