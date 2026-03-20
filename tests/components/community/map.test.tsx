import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommunityMap } from '@/components/community/map/community-map';
import { PopulationImpact } from '@/components/community/dashboard/population-impact';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  LayerGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CircleMarker: ({ children }: { children?: React.ReactNode }) => <div data-testid="circle-marker">{children}</div>,
  Marker: ({ children }: { children?: React.ReactNode }) => <div data-testid="cluster-marker">{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMapEvents: () => null,
}));

describe('community map components', () => {
  const data = {
    center: { latitude: 39.7392, longitude: -104.9903, zoom: 12 },
    households: [
      {
        id: 'household-1',
        type: 'household' as const,
        name: 'Martinez Family',
        latitude: 39.7392,
        longitude: -104.9903,
        addressLabel: 'Denver, CO',
        householdSize: 4,
      },
    ],
    assets: [
      {
        id: 'asset-1',
        type: 'asset' as const,
        name: 'Community Garden',
        latitude: 39.74,
        longitude: -104.99,
        category: 'facility',
        condition: 'good',
        addressLabel: 'Denver, CO',
      },
    ],
    programs: [
      {
        id: 'program-1',
        type: 'program' as const,
        name: 'Food Pantry',
        latitude: 39.75,
        longitude: -104.98,
        status: 'active',
        locationName: 'North Campus',
      },
    ],
    organizations: [
      {
        id: 'org-1',
        type: 'organization' as const,
        name: 'Partner Org',
        latitude: 39.76,
        longitude: -104.97,
        isReferralPartner: true,
        addressLabel: 'Aurora, CO',
      },
    ],
  };

  it('renders the map summary and filter controls', () => {
    render(<CommunityMap slug="community-hub" data={data} />);

    expect(screen.getByText('Community Map')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === '1 households')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === '1 assets')).toBeInTheDocument();
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('updates filters when a layer is toggled', () => {
    render(<CommunityMap slug="community-hub" data={data} />);

    const organizationsToggle = screen.getByLabelText('organizations');
    fireEvent.click(organizationsToggle);

    expect((organizationsToggle as HTMLInputElement).checked).toBe(false);
  });

  it('renders the population impact aggregate card', () => {
    render(<PopulationImpact servedPeople={120} denominator={1000} percentage={12} />);

    expect(screen.getByText('12.0%')).toBeInTheDocument();
    expect(screen.getByText('120 of 1,000 people served')).toBeInTheDocument();
  });
});
