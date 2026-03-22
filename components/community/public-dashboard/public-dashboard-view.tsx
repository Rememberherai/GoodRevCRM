import { PublicMetricCard } from '@/components/community/public-dashboard/public-widgets/public-metric-card';
import { PublicBarChart } from '@/components/community/public-dashboard/public-widgets/public-bar-chart';
import { PublicRadarChart } from '@/components/community/public-dashboard/public-widgets/public-radar-chart';
import { PublicProgramSummary } from '@/components/community/public-dashboard/public-widgets/public-program-summary';
import { PublicContributionSummary } from '@/components/community/public-dashboard/public-widgets/public-contribution-summary';
import { PublicTextBlock } from '@/components/community/public-dashboard/public-widgets/public-text-block';
import { PublicMapHeatmap } from '@/components/community/public-dashboard/public-widgets/public-map-heatmap';
import type { PublicDashboardAggregateData } from '@/lib/community/public-dashboard-queries';
import type { Database, Json } from '@/types/database';

type PublicDashboardConfig = Database['public']['Tables']['public_dashboard_configs']['Row'];

function parseWidgets(widgets: Json): Array<Record<string, unknown>> {
  return Array.isArray(widgets)
    ? widgets.filter((item) => typeof item === 'object' && item !== null) as Array<Record<string, unknown>>
    : [];
}

export function PublicDashboardView({
  config,
  data,
}: {
  config: PublicDashboardConfig;
  data: PublicDashboardAggregateData;
}) {
  const widgets = parseWidgets(config.widgets);
  const activeWidgets = widgets.length > 0 ? widgets : [
    { id: 'metrics', type: 'metric_card', title: 'Community Metrics' },
    { id: 'radar', type: 'radar_chart', title: 'Impact Radar' },
    { id: 'programs', type: 'program_summary', title: 'Programs' },
    { id: 'contributions', type: 'contribution_summary', title: 'Contributions' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        <div className="rounded-3xl border bg-card p-8 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">{config.title}</h1>
            {config.description && <p className="max-w-3xl text-sm text-muted-foreground">{config.description}</p>}
          </div>
        </div>

        {activeWidgets.map((widget, index) => {
          const type = String(widget.type ?? 'metric_card');
          const title = String(widget.title ?? `Widget ${index + 1}`);

          if (type === 'metric_card') {
            return <PublicMetricCard key={index} title={title} metrics={data.metrics} />;
          }

          if (type === 'bar_chart') {
            return (
              <PublicBarChart
                key={index}
                title={title}
                items={data.dimensionBreakdown.map((item) => ({
                  label: item.label,
                  value: item.totalValue,
                  color: item.color,
                }))}
              />
            );
          }

          if (type === 'radar_chart') {
            return <PublicRadarChart key={index} title={title} items={data.dimensionBreakdown} />;
          }

          if (type === 'program_summary') {
            return <PublicProgramSummary key={index} title={title} items={data.programSummary} />;
          }

          if (type === 'contribution_summary') {
            return <PublicContributionSummary key={index} title={title} items={data.contributionSummary} />;
          }

          if (type === 'map_heatmap') {
            return <PublicMapHeatmap key={index} title={title} granularity={config.geo_granularity} />;
          }

          return <PublicTextBlock key={index} title={title} text={String((widget.config as Record<string, unknown> | undefined)?.text ?? config.description ?? '')} />;
        })}
      </div>
    </div>
  );
}
