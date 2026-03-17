import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CustomReportConfig,
  ReportColumn,
  ReportFilter,
  CustomReportResult,
} from './types';
import { getReportSchema, getStaticSchema, isValidObject, getAllowedColumnNames } from './schema-registry';

// ── Constants ───────────────────────────────────────────────────────────────

const MAX_ROWS = 10_000;
const PREVIEW_ROWS = 100;

// ── Validation ──────────────────────────────────────────────────────────────

class ReportQueryError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'ReportQueryError';
  }
}

function validateConfig(config: CustomReportConfig, allowedColumns: Map<string, Set<string>>): void {
  if (!isValidObject(config.primaryObject)) {
    throw new ReportQueryError(`Invalid primary object: ${config.primaryObject}`);
  }

  if (!config.columns || config.columns.length === 0) {
    throw new ReportQueryError('At least one column is required');
  }

  if (config.columns.length > 50) {
    throw new ReportQueryError('Maximum of 50 columns allowed');
  }

  if (config.filters && config.filters.length > 30) {
    throw new ReportQueryError('Maximum of 30 filters allowed');
  }

  // Validate all referenced columns exist
  for (const col of config.columns) {
    validateFieldReference(col.objectName, col.fieldName, allowedColumns);
  }

  for (const filter of config.filters ?? []) {
    validateFieldReference(filter.objectName, filter.fieldName, allowedColumns);
  }

  for (const gb of config.groupBy ?? []) {
    // groupBy uses primary object fields
    validateFieldReference(config.primaryObject, gb, allowedColumns);
  }

  for (const agg of config.aggregations ?? []) {
    validateFieldReference(agg.objectName, agg.fieldName, allowedColumns);
  }
}

function validateFieldReference(
  objectName: string,
  fieldName: string,
  allowedColumns: Map<string, Set<string>>
): void {
  // Custom fields are accessed via JSONB and validated separately
  if (fieldName.startsWith('custom_fields.')) return;

  const cols = allowedColumns.get(objectName);
  if (!cols) {
    throw new ReportQueryError(`Invalid object reference: ${objectName}`);
  }
  if (!cols.has(fieldName)) {
    throw new ReportQueryError(`Invalid field '${fieldName}' on object '${objectName}'`);
  }
}

// ── Build Allowed Columns Map ───────────────────────────────────────────────

function buildAllowedColumnsMap(config: CustomReportConfig): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  map.set(config.primaryObject, getAllowedColumnNames(config.primaryObject));

  // Collect all referenced objects from columns, filters, aggregations
  const referencedObjects = new Set<string>();
  for (const col of config.columns) {
    referencedObjects.add(col.objectName);
  }
  for (const filter of config.filters ?? []) {
    referencedObjects.add(filter.objectName);
  }
  for (const agg of config.aggregations ?? []) {
    referencedObjects.add(agg.objectName);
  }

  for (const objName of referencedObjects) {
    if (!map.has(objName) && isValidObject(objName)) {
      map.set(objName, getAllowedColumnNames(objName));
    }
  }

  return map;
}

// ── FK Hint Resolution ───────────────────────────────────────────────────────

import type { ReportableRelation } from './types';

/**
 * Find the relation definition from primaryObject to relatedObject.
 */
function findRelation(primaryObject: string, relatedObject: string): ReportableRelation | undefined {
  const schema = getStaticSchema();
  const primaryObj = schema.objects[primaryObject];
  if (!primaryObj) return undefined;
  return primaryObj.relations.find((r) => r.targetObject === relatedObject);
}

/**
 * Build the PostgREST embedding expression for a related object's fields.
 *
 * Direct FK:    `organizations!organization_id(name, industry)`
 * Through M2M: `person_organizations!person_id(organizations!organization_id(name, industry))`
 */
function buildEmbedExpression(primaryObject: string, relatedObject: string, fields: string[]): string {
  const relation = findRelation(primaryObject, relatedObject);
  const fieldList = fields.join(', ');

  if (relation?.throughTable) {
    // M2M through join table
    return `${relation.throughTable}!${relation.foreignKey}(${relatedObject}!${relation.throughForeignKey}(${fieldList}))`;
  }

  if (relation) {
    return `${relatedObject}!${relation.foreignKey}(${fieldList})`;
  }

  // Fallback — let PostgREST auto-detect
  return `${relatedObject}(${fieldList})`;
}

// ── Tabular Query Builder (PostgREST) ───────────────────────────────────────

function buildSelectString(columns: ReportColumn[], primaryObject: string): string {
  // Group columns by object
  const primaryCols: string[] = [];
  const relatedCols: Map<string, string[]> = new Map();

  for (const col of columns) {
    // Custom fields are stored as JSONB; PostgREST select uses -> for JSONB access
    // e.g. custom_fields->my_field extracts the value from the custom_fields column
    const fieldAccess = col.fieldName.startsWith('custom_fields.')
      ? `custom_fields->>${col.fieldName.slice('custom_fields.'.length)}`
      : col.fieldName;

    if (col.objectName === primaryObject) {
      primaryCols.push(fieldAccess);
    } else {
      // Related object — use PostgREST embedding syntax
      const existing = relatedCols.get(col.objectName) ?? [];
      existing.push(fieldAccess);
      relatedCols.set(col.objectName, existing);
    }
  }

  const parts = [...primaryCols];
  for (const [objName, fields] of relatedCols) {
    parts.push(buildEmbedExpression(primaryObject, objName, fields));
  }

  return parts.join(', ');
}

function applyFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filter: ReportFilter,
  primaryObject: string
): unknown {
  const isRelated = filter.objectName !== primaryObject;
  // PostgREST JSONB filter syntax: custom_fields->>field_name
  const fieldPath = filter.fieldName.startsWith('custom_fields.')
    ? `custom_fields->>${filter.fieldName.slice('custom_fields.'.length)}`
    : filter.fieldName;

  // For related object filters in PostgREST, use embedded resource dot notation
  // e.g., organizations.name — requires the related table to be in the select string
  const column = isRelated ? `${filter.objectName}.${fieldPath}` : fieldPath;

  switch (filter.operator) {
    case 'eq':
      return query.eq(column, filter.value);
    case 'neq':
      return query.neq(column, filter.value);
    case 'gt':
      return query.gt(column, filter.value);
    case 'gte':
      return query.gte(column, filter.value);
    case 'lt':
      return query.lt(column, filter.value);
    case 'lte':
      return query.lte(column, filter.value);
    case 'like':
      return query.like(column, `%${filter.value}%`);
    case 'ilike':
      return query.ilike(column, `%${filter.value}%`);
    case 'in':
      return query.in(column, filter.value as unknown[]);
    case 'is_null':
      return query.is(column, null);
    case 'is_not_null':
      return query.not(column, 'is', null);
    case 'between':
      if (filter.value === undefined || filter.value2 === undefined) return query;
      return query.gte(column, filter.value).lte(column, filter.value2);
    default:
      return query;
  }
}

export async function executeTabularReport(
  supabase: SupabaseClient,
  config: CustomReportConfig,
  projectId: string,
  limit?: number
): Promise<CustomReportResult> {
  const startTime = Date.now();
  const rowLimit = Math.min(limit ?? config.limit ?? 500, MAX_ROWS);

  const allowedColumns = buildAllowedColumnsMap(config);
  validateConfig(config, allowedColumns);

  let selectString = buildSelectString(config.columns, config.primaryObject);

  // Ensure related tables referenced in filters are included in select (PostgREST
  // requires the embedded resource to be in the select string for dot-notation filters).
  // Use !inner join so rows without matching related records are excluded by the filter.
  const relatedTablesInSelect = new Set<string>();
  for (const col of config.columns) {
    if (col.objectName !== config.primaryObject) {
      relatedTablesInSelect.add(col.objectName);
    }
  }
  for (const filter of config.filters ?? []) {
    if (filter.objectName !== config.primaryObject && !relatedTablesInSelect.has(filter.objectName)) {
      // Add a minimal select on the related table so the filter can reference it
      const relation = findRelation(config.primaryObject, filter.objectName);
      if (relation?.throughTable) {
        // M2M through-table: filter-only embeds not supported via PostgREST dot-notation
        console.warn('[ReportQuery] Skipping M2M filter-only embed for %s (through %s)', filter.objectName, relation.throughTable);
      } else if (relation) {
        selectString += `, ${filter.objectName}!${relation.foreignKey}!inner(id)`;
      } else {
        selectString += `, ${filter.objectName}!inner(id)`;
      }
      relatedTablesInSelect.add(filter.objectName);
    }
  }

  // Get schema to check for project scoping and soft delete
  const schema = await getReportSchema(projectId);
  const primaryObj = schema.objects[config.primaryObject];

  console.log('[ReportQuery] table=%s, select=%s', config.primaryObject, selectString);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from(config.primaryObject)
    .select(selectString, { count: 'exact' });

  if (primaryObj?.projectScoped !== false) {
    query = query.eq('project_id', projectId);
  }

  if (primaryObj?.softDelete) {
    query = query.is('deleted_at', null);
  }

  // Apply filters
  for (const filter of config.filters ?? []) {
    console.log('[ReportQuery] filter: %s.%s %s %s', filter.objectName, filter.fieldName, filter.operator, filter.value);
    query = applyFilter(query, filter, config.primaryObject);
  }

  // Apply ordering
  for (const sort of config.orderBy ?? []) {
    query = query.order(sort.field, { ascending: sort.direction === 'asc' });
  }

  // Default sort by created_at desc if no ordering specified
  if (!config.orderBy?.length) {
    query = query.order('created_at', { ascending: false });
  }

  query = query.limit(rowLimit);

  const { data, error, count } = await query;

  if (error) {
    console.error('[ReportQuery] Error: table=%s, select=%s, error=%s', config.primaryObject, selectString, error.message);
    throw new ReportQueryError(`Query execution failed: ${error.message}`, 500);
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const columns = config.columns.map((c) => c.alias ?? `${c.objectName}.${c.fieldName}`);

  return {
    columns,
    rows,
    totalRows: count ?? rows.length,
    truncated: (count ?? 0) > rowLimit,
    executionMs: Date.now() - startTime,
  };
}

// ── Aggregated Query Builder (RPC) ──────────────────────────────────────────

export async function executeAggregatedReport(
  supabase: SupabaseClient,
  config: CustomReportConfig,
  projectId: string,
  limit?: number
): Promise<CustomReportResult> {
  const startTime = Date.now();
  const rowLimit = Math.min(limit ?? config.limit ?? 500, MAX_ROWS);

  const allowedColumns = buildAllowedColumnsMap(config);
  validateConfig(config, allowedColumns);

  // Build the RPC config payload
  const rpcConfig = {
    primary_object: config.primaryObject,
    columns: config.columns.map((c) => ({
      object_name: c.objectName,
      field_name: c.fieldName,
      alias: c.alias,
      aggregation: c.aggregation,
    })),
    filters: (config.filters ?? []).map((f) => ({
      object_name: f.objectName,
      field_name: f.fieldName,
      operator: f.operator,
      value: f.value,
      value2: f.value2,
    })),
    group_by: config.groupBy ?? [],
    aggregations: (config.aggregations ?? []).map((a) => ({
      object_name: a.objectName,
      field_name: a.fieldName,
      function: a.function,
      alias: a.alias,
    })),
    order_by: config.orderBy ?? [],
    limit: rowLimit,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('execute_custom_report', {
    p_config: rpcConfig,
    p_project_id: projectId,
  });

  if (error) {
    throw new ReportQueryError(`Aggregated query failed: ${error.message}`, 500);
  }

  const result = data as { rows: Record<string, unknown>[]; total_rows: number } | null;
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    // Expected shape
  } else if (result !== null) {
    throw new ReportQueryError('Unexpected response format from report engine', 500);
  }
  const rows = result?.rows ?? [];
  const totalRows = result?.total_rows ?? rows.length;

  // Derive column names from the first row, or from config
  const columns = rows.length > 0
    ? Object.keys(rows[0]!)
    : [
        ...(config.groupBy ?? []),
        ...(config.aggregations ?? []).map((a) => a.alias),
      ];

  return {
    columns,
    rows,
    totalRows,
    truncated: totalRows > rowLimit,
    executionMs: Date.now() - startTime,
  };
}

// ── Main Entry Point ────────────────────────────────────────────────────────

export async function executeCustomReport(
  supabase: SupabaseClient,
  config: CustomReportConfig,
  projectId: string,
  options?: { preview?: boolean }
): Promise<CustomReportResult> {
  const limit = options?.preview ? PREVIEW_ROWS : undefined;
  const hasAggregation = (config.groupBy?.length ?? 0) > 0 || (config.aggregations?.length ?? 0) > 0;

  if (hasAggregation) {
    return executeAggregatedReport(supabase, config, projectId, limit);
  }

  return executeTabularReport(supabase, config, projectId, limit);
}

export { ReportQueryError };
