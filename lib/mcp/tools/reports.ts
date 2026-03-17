import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import type { McpContext } from '@/types/mcp';
import { getReportSchema } from '@/lib/reports/schema-registry';
import { executeCustomReport, ReportQueryError } from '@/lib/reports/query-engine';
import type { CustomReportConfig } from '@/lib/reports/types';
import {
  reportableObjects,
  filterOperators,
  aggregationFunctions,
  customChartTypes,
} from '@/lib/validators/custom-report';

const fieldNamePattern = /^[a-z_][a-z0-9_.]*$/;

const reportColumnSchema = z.object({
  objectName: z.enum(reportableObjects),
  fieldName: z.string().min(1).max(200).regex(fieldNamePattern),
  alias: z.string().min(1).max(100).optional(),
  aggregation: z.enum(aggregationFunctions).optional(),
});

const reportFilterSchema = z.object({
  objectName: z.enum(reportableObjects),
  fieldName: z.string().min(1).max(200).regex(fieldNamePattern),
  operator: z.enum(filterOperators),
  value: z.unknown().optional(),
  value2: z.unknown().optional(),
});

const reportAggregationSchema = z.object({
  objectName: z.enum(reportableObjects),
  fieldName: z.string().min(1).max(200).regex(fieldNamePattern),
  function: z.enum(aggregationFunctions),
  alias: z.string().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/),
});

const customReportConfigSchema = z.object({
  primaryObject: z.enum(reportableObjects),
  columns: z.array(reportColumnSchema).min(1).max(50),
  filters: z.array(reportFilterSchema).max(30).default([]),
  groupBy: z.array(z.string().min(1).max(200).regex(fieldNamePattern)).max(10).optional(),
  aggregations: z.array(reportAggregationSchema).max(20).optional(),
  orderBy: z.array(z.object({ field: z.string().min(1).max(200).regex(fieldNamePattern), direction: z.enum(['asc', 'desc']) })).max(5).optional(),
  limit: z.number().int().min(1).max(10000).optional(),
  chartType: z.enum(customChartTypes).optional(),
  chartConfig: z.object({
    xAxis: z.string().max(200).optional(),
    yAxis: z.string().max(200).optional(),
    series: z.string().max(200).optional(),
  }).optional(),
});

export function registerReportTools(server: McpServer, getContext: () => McpContext) {
  // reports.get_schema
  server.tool(
    'reports.get_schema',
    'Get the schema of all reportable objects, their fields (with types), and relationships. Call this first before building a report to discover available data.',
    {},
    async () => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const schema = await getReportSchema(ctx.projectId);

      // Return a simplified version for LLM consumption
      const simplified: Record<string, {
        label: string;
        fields: { name: string; label: string; type: string; aggregatable: boolean; groupable: boolean }[];
        relations: { name: string; label: string; target: string; type: string }[];
      }> = {};

      for (const [key, obj] of Object.entries(schema.objects)) {
        simplified[key] = {
          label: obj.labelPlural,
          fields: obj.fields
            .filter((f) => f.name !== 'id' && f.name !== 'project_id' && f.name !== 'deleted_at')
            .map((f) => ({
              name: f.name,
              label: f.label,
              type: f.type,
              aggregatable: f.aggregatable,
              groupable: f.groupable,
              ...(f.enumValues ? { enumValues: f.enumValues } : {}),
            })),
          relations: obj.relations.map((r) => ({
            name: r.name,
            label: r.label,
            target: r.targetObject,
            type: r.type,
          })),
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(simplified, null, 2),
        }],
      };
    }
  );

  // reports.preview
  server.tool(
    'reports.preview',
    'Run an ad-hoc report preview without saving. Returns up to 100 rows. Use this to test a report config before saving it.',
    {
      config: customReportConfigSchema.describe('The report configuration to preview'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      try {
        const result = await executeCustomReport(
          ctx.supabase,
          params.config as CustomReportConfig,
          ctx.projectId,
          { preview: true }
        );

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              totalRows: result.totalRows,
              truncated: result.truncated,
              executionMs: result.executionMs,
              columns: result.columns,
              rows: result.rows.slice(0, 20), // Limit to 20 rows for LLM context
              ...(result.rows.length > 20 ? { note: `Showing 20 of ${result.rows.length} preview rows` } : {}),
            }, null, 2),
          }],
        };
      } catch (error) {
        const message = error instanceof ReportQueryError ? error.message : 'Report preview failed';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    }
  );

  // reports.create_custom
  server.tool(
    'reports.create_custom',
    'Create and save a new custom report. The report will appear in the Reports page.',
    {
      name: z.string().min(1).max(255).describe('Report name'),
      description: z.string().max(1000).optional().describe('Report description'),
      config: customReportConfigSchema.describe('The report configuration'),
      is_public: z.boolean().default(false).describe('Whether the report is visible to all project members'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (ctx.supabase as any)
        .from('report_definitions')
        .insert({
          project_id: ctx.projectId,
          created_by: ctx.userId,
          name: params.name,
          description: params.description ?? null,
          report_type: 'custom',
          config: params.config,
          filters: {},
          is_public: params.is_public,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create report: ${error.message}`);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            report_id: data.id,
            name: data.name,
            message: `Report "${data.name}" created successfully. It's now available in the Reports page.`,
          }),
        }],
      };
    }
  );

  // reports.run
  server.tool(
    'reports.run',
    'Execute a saved report by its ID and return the results.',
    {
      report_id: z.string().uuid().describe('The report definition ID to execute'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      // Fetch report definition
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: report, error: reportError } = await (ctx.supabase as any)
        .from('report_definitions')
        .select('*')
        .eq('id', params.report_id)
        .eq('project_id', ctx.projectId)
        .single();

      if (reportError || !report) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Report not found' }) }],
          isError: true,
        };
      }

      if (report.report_type !== 'custom') {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Only custom reports can be run via this tool' }) }],
          isError: true,
        };
      }

      try {
        const result = await executeCustomReport(
          ctx.supabase,
          report.config as CustomReportConfig,
          ctx.projectId
        );

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              reportName: report.name,
              totalRows: result.totalRows,
              truncated: result.truncated,
              executionMs: result.executionMs,
              columns: result.columns,
              rows: result.rows.slice(0, 50), // Limit for LLM context
              ...(result.rows.length > 50 ? { note: `Showing 50 of ${result.totalRows} total rows` } : {}),
            }, null, 2),
          }],
        };
      } catch (error) {
        const message = error instanceof ReportQueryError ? error.message : 'Report execution failed';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    }
  );

  // reports.list
  server.tool(
    'reports.list',
    'List all saved reports in the project.',
    {
      report_type: z.string().optional().describe('Filter by report type (e.g., "custom", "pipeline")'),
      limit: z.number().int().min(1).max(100).default(20).describe('Max reports to return'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (ctx.supabase as any)
        .from('report_definitions')
        .select('id, name, description, report_type, schedule, is_public, last_run_at, created_at')
        .eq('project_id', ctx.projectId)
        .order('created_at', { ascending: false })
        .limit(params.limit);

      if (params.report_type) {
        query = query.eq('report_type', params.report_type);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list reports: ${error.message}`);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ reports: data ?? [], total: (data ?? []).length }),
        }],
      };
    }
  );

  // reports.update_custom
  server.tool(
    'reports.update_custom',
    'Update an existing custom report configuration.',
    {
      report_id: z.string().uuid().describe('The report ID to update'),
      name: z.string().min(1).max(255).optional().describe('New report name'),
      description: z.string().max(1000).optional().describe('New description'),
      config: customReportConfigSchema.optional().describe('Updated report configuration'),
      is_public: z.boolean().optional().describe('Updated visibility'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const updates: Record<string, unknown> = {};
      if (params.name) updates.name = params.name;
      if (params.description !== undefined) updates.description = params.description;
      if (params.config) updates.config = params.config;
      if (params.is_public !== undefined) updates.is_public = params.is_public;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (ctx.supabase as any)
        .from('report_definitions')
        .update(updates)
        .eq('id', params.report_id)
        .eq('project_id', ctx.projectId)
        .select()
        .single();

      if (error) throw new Error(`Failed to update report: ${error.message}`);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            report_id: data.id,
            name: data.name,
            message: `Report "${data.name}" updated successfully.`,
          }),
        }],
      };
    }
  );

  // reports.delete
  server.tool(
    'reports.delete',
    'Delete a saved report.',
    {
      report_id: z.string().uuid().describe('The report ID to delete'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'admin');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (ctx.supabase as any)
        .from('report_definitions')
        .delete()
        .eq('id', params.report_id)
        .eq('project_id', ctx.projectId);

      if (error) throw new Error(`Failed to delete report: ${error.message}`);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ success: true, message: 'Report deleted.' }),
        }],
      };
    }
  );
}
