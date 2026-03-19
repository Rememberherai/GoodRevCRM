import type {
  CustomReportConfig,
  ReportColumn,
  ReportAggregation,
  CustomChartType,
  ReportSchema,
} from './types';

// ── Template Interface ──────────────────────────────────────────────────────

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  objectKey: string; // matches key in schema.objects (for icon/color reuse)
  category: 'sales' | 'operations';
  config: CustomReportConfig;
}

// ── Built-in Templates ──────────────────────────────────────────────────────

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'template-pipeline-by-stage',
    name: 'Pipeline by Stage',
    description: 'Deal count and total value broken down by pipeline stage.',
    objectKey: 'opportunities',
    category: 'sales',
    config: {
      primaryObject: 'opportunities',
      columns: [
        { objectName: 'opportunities', fieldName: 'stage' },
        { objectName: 'opportunities', fieldName: 'amount' },
      ],
      filters: [],
      groupBy: ['stage'],
      aggregations: [
        { objectName: 'opportunities', fieldName: 'amount', function: 'sum', alias: 'total_amount' },
        { objectName: 'opportunities', fieldName: 'id', function: 'count', alias: 'record_count' },
      ],
      chartType: 'bar',
    },
  },
  {
    id: 'template-revenue-over-time',
    name: 'Revenue Over Time',
    description: 'Track closed deal revenue by close date (won deals only).',
    objectKey: 'opportunities',
    category: 'sales',
    config: {
      primaryObject: 'opportunities',
      columns: [
        { objectName: 'opportunities', fieldName: 'actual_close_date' },
        { objectName: 'opportunities', fieldName: 'amount' },
      ],
      filters: [
        { objectName: 'opportunities', fieldName: 'stage', operator: 'eq', value: 'closed_won' },
      ],
      groupBy: ['actual_close_date'],
      aggregations: [
        { objectName: 'opportunities', fieldName: 'amount', function: 'sum', alias: 'total_amount' },
        { objectName: 'opportunities', fieldName: 'id', function: 'count', alias: 'record_count' },
      ],
      chartType: 'line',
    },
  },
  {
    id: 'template-activity-by-type',
    name: 'Activity by Type',
    description: 'See how many activities and total time spent by type.',
    objectKey: 'activity_log',
    category: 'operations',
    config: {
      primaryObject: 'activity_log',
      columns: [
        { objectName: 'activity_log', fieldName: 'activity_type' },
        { objectName: 'activity_log', fieldName: 'duration_minutes' },
      ],
      filters: [],
      groupBy: ['activity_type'],
      aggregations: [
        { objectName: 'activity_log', fieldName: 'id', function: 'count', alias: 'record_count' },
        { objectName: 'activity_log', fieldName: 'duration_minutes', function: 'sum', alias: 'total_duration' },
      ],
      chartType: 'bar',
    },
  },
  {
    id: 'template-deals-by-org',
    name: 'Deals by Organization',
    description: 'Total deal value and count grouped by organization ID.',
    objectKey: 'opportunities',
    category: 'sales',
    config: {
      primaryObject: 'opportunities',
      columns: [
        { objectName: 'opportunities', fieldName: 'organization_id' },
        { objectName: 'opportunities', fieldName: 'amount' },
      ],
      filters: [],
      groupBy: ['organization_id'],
      aggregations: [
        { objectName: 'opportunities', fieldName: 'amount', function: 'sum', alias: 'total_amount' },
        { objectName: 'opportunities', fieldName: 'id', function: 'count', alias: 'record_count' },
      ],
      chartType: 'bar',
    },
  },
  {
    id: 'template-rfp-status',
    name: 'RFP Status Summary',
    description: 'RFP count and estimated value by status.',
    objectKey: 'rfps',
    category: 'sales',
    config: {
      primaryObject: 'rfps',
      columns: [
        { objectName: 'rfps', fieldName: 'status' },
        { objectName: 'rfps', fieldName: 'estimated_value' },
      ],
      filters: [],
      groupBy: ['status'],
      aggregations: [
        { objectName: 'rfps', fieldName: 'estimated_value', function: 'sum', alias: 'total_value' },
        { objectName: 'rfps', fieldName: 'id', function: 'count', alias: 'record_count' },
      ],
      chartType: 'pie',
    },
  },
  {
    id: 'template-meeting-outcomes',
    name: 'Meeting Outcomes',
    description: 'Meeting count by status (attended, no-show, cancelled).',
    objectKey: 'meetings',
    category: 'operations',
    config: {
      primaryObject: 'meetings',
      columns: [
        { objectName: 'meetings', fieldName: 'status' },
      ],
      filters: [],
      groupBy: ['status'],
      aggregations: [
        { objectName: 'meetings', fieldName: 'id', function: 'count', alias: 'record_count' },
      ],
      chartType: 'pie',
    },
  },
  {
    id: 'template-task-completion',
    name: 'Task Completion',
    description: 'Task count by status to track completion rates.',
    objectKey: 'tasks',
    category: 'operations',
    config: {
      primaryObject: 'tasks',
      columns: [
        { objectName: 'tasks', fieldName: 'status' },
      ],
      filters: [],
      groupBy: ['status'],
      aggregations: [
        { objectName: 'tasks', fieldName: 'id', function: 'count', alias: 'record_count' },
      ],
      chartType: 'bar',
    },
  },
];

// ── Smart Defaults ──────────────────────────────────────────────────────────

export function getSmartDefaults(objectName: string, schema: ReportSchema): {
  columns: ReportColumn[];
  groupBy: string[];
  aggregations: ReportAggregation[];
  chartType: CustomChartType;
} {
  const obj = schema.objects[objectName];
  if (!obj) {
    return { columns: [], groupBy: [], aggregations: [], chartType: 'table' };
  }

  const columns: ReportColumn[] = [];
  const groupBy: string[] = [];
  const aggregations: ReportAggregation[] = [];

  // 1. Find best groupBy candidate: prefer enum fields, then groupable text fields
  const enumField = obj.fields.find(
    (f) => f.type === 'enum' && f.groupable && f.enumValues && f.enumValues.length > 0
  );
  const groupableTextField = obj.fields.find(
    (f) => f.groupable && f.type === 'text' && f.name !== 'id' && !f.name.endsWith('_id')
  );
  const groupField = enumField ?? groupableTextField;

  if (groupField) {
    groupBy.push(groupField.name);
    columns.push({ objectName, fieldName: groupField.name });
  }

  // 2. Find currency field → SUM aggregation
  const currencyField = obj.fields.find((f) => f.type === 'currency' && f.aggregatable);
  if (currencyField) {
    aggregations.push({
      objectName,
      fieldName: currencyField.name,
      function: 'sum',
      alias: `total_${currencyField.name}`,
    });
    columns.push({ objectName, fieldName: currencyField.name });
  }

  // 3. Find percentage field → AVG aggregation (if different from currency)
  const percentageField = obj.fields.find((f) => f.type === 'percentage' && f.aggregatable);
  if (percentageField) {
    aggregations.push({
      objectName,
      fieldName: percentageField.name,
      function: 'avg',
      alias: `avg_${percentageField.name}`,
    });
    columns.push({ objectName, fieldName: percentageField.name });
  }

  // 4. Always add COUNT(id) — no column needed, RPC handles it via aggregations
  aggregations.push({
    objectName,
    fieldName: 'id',
    function: 'count',
    alias: 'record_count',
  });

  // 5. Chart type: bar if grouped, table otherwise
  const chartType: CustomChartType = groupBy.length > 0 ? 'bar' : 'table';

  return { columns, groupBy, aggregations, chartType };
}
