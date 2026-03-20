import { describe, expect, it } from 'vitest';
import { clusterMapPoints, computeMapCenter, type HouseholdMapPoint } from '@/lib/community/map';

describe('community map utilities', () => {
  it('computes a fallback center when no points are present', () => {
    expect(computeMapCenter([])).toEqual({
      latitude: 39.7392,
      longitude: -104.9903,
      zoom: 10,
    });
  });

  it('computes the center from available coordinates', () => {
    const center = computeMapCenter([
      [
        { latitude: 40, longitude: -105 },
        { latitude: 39, longitude: -104 },
      ],
    ]);

    expect(center.latitude).toBe(39.5);
    expect(center.longitude).toBe(-104.5);
    expect(center.zoom).toBe(12);
  });

  it('clusters nearby points more aggressively when zoomed out', () => {
    const points: HouseholdMapPoint[] = [
      {
        id: '1',
        type: 'household',
        name: 'Alpha',
        latitude: 39.7392,
        longitude: -104.9903,
        addressLabel: null,
        householdSize: 2,
      },
      {
        id: '2',
        type: 'household',
        name: 'Beta',
        latitude: 39.7396,
        longitude: -104.9907,
        addressLabel: null,
        householdSize: 3,
      },
    ];

    expect(clusterMapPoints(points, 9)).toHaveLength(1);
    expect(clusterMapPoints(points, 16)).toHaveLength(2);
  });
});
