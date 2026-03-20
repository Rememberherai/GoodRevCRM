import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatGeocodeAddress, geocodeAddress } from '@/lib/community/geocoding';
import { processGeocodeTargets } from '@/lib/community/geocoding-queue';

describe('community geocoding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('formats a Nominatim query from address parts', () => {
    expect(formatGeocodeAddress({
      street: '123 Main St',
      city: 'Denver',
      state: 'CO',
      postalCode: '80202',
      country: 'USA',
    })).toBe('123 Main St, Denver, CO, 80202, USA');
  });

  it('returns the first parsed geocode result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        lat: '39.7392',
        lon: '-104.9903',
        display_name: 'Denver, Colorado, USA',
      }],
    }));

    await expect(geocodeAddress({ city: 'Denver', state: 'CO' })).resolves.toEqual({
      latitude: 39.7392,
      longitude: -104.9903,
      displayName: 'Denver, Colorado, USA',
    });
  });

  it('rate limits sequential geocode processing to one request per second', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const persist = vi.fn().mockResolvedValue(undefined);

    const summary = await processGeocodeTargets({
      targets: [{ id: '1' }, { id: '2' }, { id: '3' }],
      geocode: vi.fn()
        .mockResolvedValueOnce({ latitude: 1, longitude: 1 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ latitude: 2, longitude: 2 }),
      persist,
      sleep,
    });

    expect(summary).toEqual({
      processed: 3,
      succeeded: 2,
      failed: 1,
    });
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(sleep).toHaveBeenNthCalledWith(2, 1000);
    expect(persist).toHaveBeenCalledTimes(3);
  });
});
