import type { Database, Json } from '@/types/database';
import type { PublicDashboardAggregateData } from './public-dashboard-queries';

type PublicDashboardConfig = Database['public']['Tables']['public_dashboard_configs']['Row'];

const WIDGET_IDS = {
  metrics: '00000000-0000-0000-0000-000000000001',
  bar: '00000000-0000-0000-0000-000000000002',
  radar: '00000000-0000-0000-0000-000000000003',
  programs: '00000000-0000-0000-0000-000000000004',
  contributions: '00000000-0000-0000-0000-000000000005',
  text: '00000000-0000-0000-0000-000000000006',
  map: '00000000-0000-0000-0000-000000000007',
};

export const SAMPLE_DASHBOARD_CONFIG: PublicDashboardConfig = {
  id: '00000000-0000-0000-0000-sample000001',
  project_id: '',
  title: 'Greenfield Community Impact Dashboard',
  description:
    'A snapshot of how Greenfield Community Center serves residents through education, health, housing, and economic empowerment programs.',
  slug: 'sample-preview',
  status: 'published',
  access_type: 'public',
  data_freshness: 'live',
  date_range_type: 'rolling',
  date_range_start: null,
  date_range_end: null,
  geo_granularity: 'zip',
  min_count_threshold: 3,
  excluded_categories: ['minors', 'intake', 'risk_scores', 'PII'],
  widget_order: Object.values(WIDGET_IDS),
  widgets: [
    { id: WIDGET_IDS.metrics, type: 'metric_card', title: 'Community at a Glance' },
    { id: WIDGET_IDS.radar, type: 'radar_chart', title: 'Impact by Dimension' },
    { id: WIDGET_IDS.bar, type: 'bar_chart', title: 'Contributions by Focus Area' },
    { id: WIDGET_IDS.programs, type: 'program_summary', title: 'Program Highlights' },
    { id: WIDGET_IDS.contributions, type: 'contribution_summary', title: 'Contribution Breakdown' },
    { id: WIDGET_IDS.text, type: 'text_block', title: 'About This Dashboard', config: { text: 'This public dashboard shares aggregate community impact data with funders, board members, and the broader community. Individual-level data is never exposed — only group-level summaries that meet minimum count thresholds.' } },
    { id: WIDGET_IDS.map, type: 'map_heatmap', title: 'Geographic Coverage' },
  ] as unknown as Json,
  theme: {} as Json,
  hero_image_url: null,
  password_hash: null,
  snapshot_data: null,
  published_at: '2026-01-15T00:00:00Z',
  published_by: null,
  archived_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
};

export const SAMPLE_DASHBOARD_DATA: PublicDashboardAggregateData = {
  metrics: [
    { label: 'Households Served', value: 247 },
    { label: 'Programs', value: 8 },
    { label: 'Contributions', value: 1342 },
    { label: 'Attendance Records', value: 5891 },
  ],
  programSummary: [
    { name: 'Youth Mentorship Program', status: 'active', enrollmentCount: 64, attendanceCount: 1240 },
    { name: 'Food Security Initiative', status: 'active', enrollmentCount: 112, attendanceCount: 2380 },
    { name: 'Job Training & Placement', status: 'active', enrollmentCount: 38, attendanceCount: 890 },
    { name: 'Health & Wellness Screenings', status: 'completed', enrollmentCount: 95, attendanceCount: 1381 },
  ],
  contributionSummary: [
    { type: 'monetary', totalValue: 125400, count: 342 },
    { type: 'in_kind', totalValue: 45200, count: 189 },
    { type: 'volunteer_hours', totalValue: 28800, count: 811 },
    { type: 'grant', totalValue: 210000, count: 12 },
  ],
  dimensionBreakdown: [
    { label: 'Economic Empowerment', totalValue: 98500, count: 215, color: '#3b82f6' },
    { label: 'Health & Nutrition', totalValue: 72300, count: 184, color: '#22c55e' },
    { label: 'Education', totalValue: 64800, count: 298, color: '#a855f7' },
    { label: 'Housing Stability', totalValue: 51200, count: 127, color: '#f59e0b' },
    { label: 'Social Capital', totalValue: 22600, count: 518, color: '#ec4899' },
  ],
};
