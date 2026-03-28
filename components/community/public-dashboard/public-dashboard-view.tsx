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

// Deprecated: widget_order is no longer authored by the UI. The widgets array
// order is authoritative. widget_order remains in the DB/validator for backward
// compatibility but is ignored by this component.
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

  const hasHeroImage = !!config.hero_image_url;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-12 md:space-y-16 px-4 py-10">
        {/* Hero */}
        <div
          className="animate-in fade-in duration-700 rounded-3xl overflow-hidden relative"
          style={{ animationDuration: '700ms' }}
        >
          {hasHeroImage ? (
            <>
              <img
                src={config.hero_image_url!}
                alt=""
                className="h-[320px] md:h-[400px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white drop-shadow-lg">
                  {config.title}
                </h1>
                {config.description && (
                  <p className="mt-3 max-w-2xl text-base md:text-lg text-white/85">
                    {config.description}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="bg-gradient-to-br from-primary/5 via-background to-teal-500/5 p-8 md:p-12 lg:p-16">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
                {config.title}
              </h1>
              {config.description && (
                <p className="mt-3 max-w-2xl text-base md:text-lg text-muted-foreground">
                  {config.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Widgets */}
        {activeWidgets.map((widget, index) => {
          const type = String(widget.type ?? 'metric_card');
          const title = String(widget.title ?? `Widget ${index + 1}`);

          let content: React.ReactNode = null;

          if (type === 'metric_card') {
            content = <PublicMetricCard title={title} metrics={data.metrics} />;
          } else if (type === 'bar_chart') {
            content = (
              <PublicBarChart
                title={title}
                items={data.dimensionBreakdown.map((item) => ({
                  label: item.label,
                  value: item.totalValue,
                  color: item.color,
                }))}
              />
            );
          } else if (type === 'radar_chart') {
            content = <PublicRadarChart title={title} items={data.dimensionBreakdown} />;
          } else if (type === 'program_summary') {
            content = <PublicProgramSummary title={title} items={data.programSummary} />;
          } else if (type === 'contribution_summary') {
            content = <PublicContributionSummary title={title} items={data.contributionSummary} />;
          } else if (type === 'map_heatmap') {
            content = <PublicMapHeatmap title={title} granularity={config.geo_granularity} />;
          } else {
            content = <PublicTextBlock title={title} text={String((widget.config as Record<string, unknown> | undefined)?.text ?? config.description ?? '')} />;
          }

          return (
            <div
              key={index}
              className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
              style={{ animationDelay: `${(index + 1) * 150}ms`, animationDuration: '700ms' }}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
