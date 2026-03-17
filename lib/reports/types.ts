// Custom Report Builder Types

// ── Field & Schema Types ────────────────────────────────────────────────────

export type ReportFieldType =
  | 'text'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'enum'
  | 'uuid';

export interface ReportableField {
  name: string;
  label: string;
  type: ReportFieldType;
  aggregatable: boolean;
  groupable: boolean;
  filterable: boolean;
  enumValues?: string[];
  isCustomField?: boolean;
}

export type ReportRelationType = 'belongs_to' | 'has_many';

export interface ReportableRelation {
  name: string;
  label: string;
  targetObject: string;
  type: ReportRelationType;
  foreignKey: string;
  targetKey: string;
}

export interface ReportableObject {
  name: string;
  label: string;
  labelPlural: string;
  softDelete: boolean;
  projectScoped: boolean;
  fields: ReportableField[];
  relations: ReportableRelation[];
}

// ── Custom Report Config Types ──────────────────────────────────────────────

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'in'
  | 'is_null'
  | 'is_not_null'
  | 'between';

export type AggregationFunction = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'count_distinct';

export type CustomChartType = 'table' | 'bar' | 'line' | 'pie' | 'funnel';

export interface ReportColumn {
  objectName: string;
  fieldName: string;
  alias?: string;
  aggregation?: AggregationFunction;
}

export interface ReportFilter {
  objectName: string;
  fieldName: string;
  operator: FilterOperator;
  value?: unknown;
  value2?: unknown;
}

export interface ReportAggregation {
  objectName: string;
  fieldName: string;
  function: AggregationFunction;
  alias: string;
}

export interface ReportOrderBy {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ChartConfig {
  xAxis?: string;
  yAxis?: string;
  series?: string;
}

export interface CustomReportConfig {
  primaryObject: string;
  columns: ReportColumn[];
  filters: ReportFilter[];
  groupBy?: string[];
  aggregations?: ReportAggregation[];
  orderBy?: ReportOrderBy[];
  limit?: number;
  chartType?: CustomChartType;
  chartConfig?: ChartConfig;
}

// ── Schema API Response ─────────────────────────────────────────────────────

export interface ReportSchema {
  objects: Record<string, ReportableObject>;
}

// ── Report Preview/Run Result ───────────────────────────────────────────────

export interface CustomReportResult {
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  truncated: boolean;
  executionMs: number;
}
