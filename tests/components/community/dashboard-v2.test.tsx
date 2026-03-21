import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MiniMap } from '@/components/community/dashboard/mini-map';
import { PopulationImpact } from '@/components/community/dashboard/population-impact';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="mini-map-container" className={className}>{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  CircleMarker: () => <div data-testid="circle-marker" />,
}));

describe('Dashboard V2 — MiniMap', () => {
  const center = { latitude: 39.7392, longitude: -104.9903, zoom: 12 };
  const points = [
    { id: 'h-1', latitude: 39.74, longitude: -104.99 },
    { id: 'h-2', latitude: 39.75, longitude: -104.98 },
    { id: 'h-3', latitude: 39.73, longitude: -105.0 },
  ];

  it('renders the community coverage card with a map container', () => {
    render(<MiniMap center={center} points={points} />);

    expect(screen.getByText('Community Coverage')).toBeInTheDocument();
    expect(screen.getByTestId('mini-map-container')).toBeInTheDocument();
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
  });

  it('renders a circle marker for each household point', () => {
    render(<MiniMap center={center} points={points} />);

    const markers = screen.getAllByTestId('circle-marker');
    expect(markers).toHaveLength(3);
  });

  it('renders zero markers when no points are provided', () => {
    render(<MiniMap center={center} points={[]} />);

    expect(screen.queryAllByTestId('circle-marker')).toHaveLength(0);
    expect(screen.getByTestId('mini-map-container')).toBeInTheDocument();
  });
});

describe('Dashboard V2 — PopulationImpact', () => {
  it('displays percentage and served count when denominator is set', () => {
    render(<PopulationImpact servedPeople={250} denominator={5000} percentage={5} />);

    expect(screen.getByText('5.0%')).toBeInTheDocument();
    expect(screen.getByText('250 of 5,000 people served')).toBeInTheDocument();
  });

  it('shows dash and instructional text when denominator is null', () => {
    render(<PopulationImpact servedPeople={42} denominator={null} percentage={null} />);

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText(/community_population_denominator/)).toBeInTheDocument();
  });

  it('renders zero percentage correctly', () => {
    render(<PopulationImpact servedPeople={0} denominator={1000} percentage={0} />);

    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(screen.getByText('0 of 1,000 people served')).toBeInTheDocument();
  });

  it('formats large numbers with locale separators', () => {
    render(<PopulationImpact servedPeople={12345} denominator={100000} percentage={12.345} />);

    expect(screen.getByText('12.3%')).toBeInTheDocument();
    expect(screen.getByText('12,345 of 100,000 people served')).toBeInTheDocument();
  });
});
