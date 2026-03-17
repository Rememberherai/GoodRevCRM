'use client';

import {
  Table,
  BarChart3,
  LineChart,
  PieChart,
  GitMerge,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CustomChartType, ChartConfig, ReportColumn, ReportAggregation } from '@/lib/reports/types';

interface ChartConfigProps {
  chartType: CustomChartType;
  chartConfig: ChartConfig;
  columns: ReportColumn[];
  groupBy: string[];
  aggregations: ReportAggregation[];
  onChartTypeChange: (type: CustomChartType) => void;
  onChartConfigChange: (config: ChartConfig) => void;
}

const CHART_OPTIONS: { type: CustomChartType; label: string; icon: React.ElementType; description: string }[] = [
  { type: 'table', label: 'Table', icon: Table, description: 'Tabular data view' },
  { type: 'bar', label: 'Bar Chart', icon: BarChart3, description: 'Compare values across categories' },
  { type: 'line', label: 'Line Chart', icon: LineChart, description: 'Show trends over time' },
  { type: 'pie', label: 'Pie Chart', icon: PieChart, description: 'Show proportions of a whole' },
  { type: 'funnel', label: 'Funnel', icon: GitMerge, description: 'Show sequential conversion stages' },
];

export function ChartConfigPanel({
  chartType,
  chartConfig,
  columns,
  groupBy,
  aggregations,
  onChartTypeChange,
  onChartConfigChange,
}: ChartConfigProps) {
  const allFieldNames = [
    ...columns.map((c) => c.alias ?? `${c.objectName}.${c.fieldName}`),
    ...groupBy,
    ...aggregations.map((a) => a.alias),
  ];

  const needsAxisConfig = chartType !== 'table';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Visualization</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose how to display your report data.
        </p>
      </div>

      {/* Chart type picker */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {CHART_OPTIONS.map((opt) => {
          const isSelected = chartType === opt.type;
          return (
            <Card
              key={opt.type}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                isSelected
                  ? 'ring-2 ring-primary border-primary'
                  : 'hover:border-primary/30'
              }`}
              onClick={() => onChartTypeChange(opt.type)}
            >
              <CardContent className="pt-4 pb-3 text-center">
                <opt.icon
                  className={`h-8 w-8 mx-auto mb-2 ${
                    isSelected ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {opt.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Axis config for charts */}
      {needsAxisConfig && allFieldNames.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 p-4 border rounded-lg bg-muted/20">
          <div className="space-y-2">
            <Label className="text-sm font-medium">X-Axis / Category</Label>
            <Select
              value={chartConfig.xAxis ?? ''}
              onValueChange={(val) =>
                onChartConfigChange({ ...chartConfig, xAxis: val || undefined })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Auto-detect" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__auto__">Auto-detect</SelectItem>
                {allFieldNames.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Y-Axis / Value</Label>
            <Select
              value={chartConfig.yAxis ?? ''}
              onValueChange={(val) =>
                onChartConfigChange({ ...chartConfig, yAxis: val || undefined })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Auto-detect" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__auto__">Auto-detect</SelectItem>
                {allFieldNames.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(chartType === 'bar' || chartType === 'line') && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Series / Color Split</Label>
              <Select
                value={chartConfig.series ?? ''}
                onValueChange={(val) =>
                  onChartConfigChange({ ...chartConfig, series: val || undefined })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {allFieldNames.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
