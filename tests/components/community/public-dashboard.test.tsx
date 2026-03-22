import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PublicMetricCard } from '@/components/community/public-dashboard/public-widgets/public-metric-card';
import { PublicContributionSummary } from '@/components/community/public-dashboard/public-widgets/public-contribution-summary';

describe('public dashboard widgets', () => {
  it('renders aggregate metric cards', () => {
    render(
      <PublicMetricCard
        title="Community Metrics"
        metrics={[
          { label: 'Households Served', value: 24 },
          { label: 'Programs', value: 6 },
        ]}
      />
    );

    expect(screen.getByText('Community Metrics')).toBeInTheDocument();
    expect(screen.getByText('Households Served')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it('renders contribution summary groups', () => {
    render(
      <PublicContributionSummary
        title="Contribution Totals"
        items={[
          { type: 'monetary', totalValue: 1200, count: 3 },
        ]}
      />
    );

    expect(screen.getByText('Contribution Totals')).toBeInTheDocument();
    expect(screen.getByText('monetary')).toBeInTheDocument();
    expect(screen.getByText('3 records • $1,200')).toBeInTheDocument();
  });
});
