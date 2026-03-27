import {
  Activity,
  BarChart3,
  FileText,
  LayoutList,
  MapPin,
  PieChart,
  Radar,
  type LucideIcon,
} from 'lucide-react';

export interface WidgetTypeMeta {
  icon: LucideIcon;
  label: string;
  description: string;
  color: string;
  disabled?: boolean;
}

export const WIDGET_TYPE_META: Record<string, WidgetTypeMeta> = {
  metric_card: {
    icon: Activity,
    label: 'Metric Card',
    description: 'Key metrics displayed as counters',
    color: 'blue',
  },
  bar_chart: {
    icon: BarChart3,
    label: 'Bar Chart',
    description: 'Compare values across categories',
    color: 'emerald',
  },
  radar_chart: {
    icon: Radar,
    label: 'Radar Chart',
    description: 'Multi-dimensional impact comparison',
    color: 'violet',
  },
  program_summary: {
    icon: LayoutList,
    label: 'Program Summary',
    description: 'Program enrollment and attendance overview',
    color: 'amber',
  },
  contribution_summary: {
    icon: PieChart,
    label: 'Contribution Summary',
    description: 'Breakdown of contributions by type',
    color: 'rose',
  },
  text_block: {
    icon: FileText,
    label: 'Text Block',
    description: 'Custom text content or descriptions',
    color: 'slate',
  },
  map_heatmap: {
    icon: MapPin,
    label: 'Map Heatmap',
    description: 'Geographic coverage visualization',
    color: 'teal',
    disabled: true,
  },
};

export function getWidgetMeta(type: string): WidgetTypeMeta {
  return WIDGET_TYPE_META[type] ?? WIDGET_TYPE_META.text_block!;
}
