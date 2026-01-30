import { describe, it, expect } from 'vitest';
import {
  createReportSchema,
  updateReportSchema,
  reportQuerySchema,
  reportRunQuerySchema,
  createWidgetSchema,
  updateWidgetSchema,
  widgetQuerySchema,
  dateRangeQuerySchema,
  metricsQuerySchema,
  reportConfigSchema,
  reportFiltersSchema,
} from '@/lib/validators/report';

describe('Report Validators', () => {
  describe('createReportSchema', () => {
    it('should validate a valid report', () => {
      const input = {
        name: 'Monthly Pipeline Report',
        description: 'Overview of pipeline by stage',
        report_type: 'pipeline',
        config: {
          chart_type: 'bar',
          time_range: 'month',
        },
        filters: {},
        schedule: 'weekly',
        is_public: true,
      };

      const result = createReportSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require name and report_type', () => {
      const input = {};

      const result = createReportSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept minimal report', () => {
      const input = {
        name: 'Simple Report',
        report_type: 'activity',
      };

      const result = createReportSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid report type', () => {
      const input = {
        name: 'Test Report',
        report_type: 'invalid',
      };

      const result = createReportSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept all valid report types', () => {
      const types = ['pipeline', 'activity', 'conversion', 'revenue', 'team_performance', 'custom'];

      for (const report_type of types) {
        const result = createReportSchema.safeParse({
          name: 'Test',
          report_type,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid schedules', () => {
      const schedules = ['daily', 'weekly', 'monthly', 'quarterly', null];

      for (const schedule of schedules) {
        const result = createReportSchema.safeParse({
          name: 'Test',
          report_type: 'pipeline',
          schedule,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject name longer than 255 characters', () => {
      const input = {
        name: 'a'.repeat(256),
        report_type: 'pipeline',
      };

      const result = createReportSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateReportSchema', () => {
    it('should validate partial updates', () => {
      const input = {
        name: 'Updated Name',
      };

      const result = updateReportSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow empty update', () => {
      const input = {};

      const result = updateReportSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate config updates', () => {
      const input = {
        config: {
          chart_type: 'line',
          metrics: ['revenue', 'count'],
          show_comparison: true,
        },
      };

      const result = updateReportSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('reportConfigSchema', () => {
    it('should validate complete config', () => {
      const input = {
        chart_type: 'bar',
        metrics: ['revenue', 'count', 'average'],
        group_by: 'stage',
        time_range: 'quarter',
        show_comparison: true,
        custom_query: 'SELECT * FROM opportunities',
      };

      const result = reportConfigSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept all valid chart types', () => {
      const chartTypes = ['bar', 'line', 'pie', 'funnel', 'table'];

      for (const chart_type of chartTypes) {
        const result = reportConfigSchema.safeParse({ chart_type });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid time ranges', () => {
      const timeRanges = ['day', 'week', 'month', 'quarter', 'year'];

      for (const time_range of timeRanges) {
        const result = reportConfigSchema.safeParse({ time_range });
        expect(result.success).toBe(true);
      }
    });

    it('should reject custom_query longer than 5000 characters', () => {
      const input = {
        custom_query: 'a'.repeat(5001),
      };

      const result = reportConfigSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('reportFiltersSchema', () => {
    it('should validate complete filters', () => {
      const input = {
        date_range: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-12-31T23:59:59Z',
        },
        stages: ['550e8400-e29b-41d4-a716-446655440000'],
        owners: ['550e8400-e29b-41d4-a716-446655440001'],
        statuses: ['open', 'won'],
        tags: ['important', 'enterprise'],
      };

      const result = reportFiltersSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow empty filters', () => {
      const input = {};

      const result = reportFiltersSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate date_range format', () => {
      const input = {
        date_range: {
          start: 'invalid-date',
          end: '2024-12-31',
        },
      };

      const result = reportFiltersSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require valid UUIDs for stages', () => {
      const input = {
        stages: ['not-a-uuid'],
      };

      const result = reportFiltersSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('reportQuerySchema', () => {
    it('should parse valid query', () => {
      const input = {
        report_type: 'pipeline',
        is_public: 'true',
        limit: '25',
        offset: '10',
      };

      const result = reportQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.report_type).toBe('pipeline');
        expect(result.data.is_public).toBe(true);
        expect(result.data.limit).toBe(25);
        expect(result.data.offset).toBe(10);
      }
    });

    it('should use default limit and offset', () => {
      const input = {};

      const result = reportQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should reject limit > 100', () => {
      const input = { limit: '200' };

      const result = reportQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('reportRunQuerySchema', () => {
    it('should parse valid query', () => {
      const input = {
        status: 'completed',
        limit: '50',
        offset: '20',
      };

      const result = reportRunQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('completed');
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(20);
      }
    });

    it('should accept all valid statuses', () => {
      const statuses = ['pending', 'running', 'completed', 'failed'];

      for (const status of statuses) {
        const result = reportRunQuerySchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const input = { status: 'invalid' };

      const result = reportRunQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('createWidgetSchema', () => {
    it('should validate a valid widget', () => {
      const input = {
        widget_type: 'pipeline_chart',
        config: {
          title: 'My Pipeline',
          time_range: 'month',
          limit: 10,
        },
        position: 0,
        size: 'large',
        is_visible: true,
      };

      const result = createWidgetSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require widget_type', () => {
      const input = {};

      const result = createWidgetSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept all valid widget types', () => {
      const types = [
        'pipeline_chart',
        'activity_feed',
        'conversion_rate',
        'revenue_chart',
        'top_opportunities',
        'recent_activities',
        'task_summary',
        'team_leaderboard',
      ];

      for (const widget_type of types) {
        const result = createWidgetSchema.safeParse({ widget_type });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid sizes', () => {
      const sizes = ['small', 'medium', 'large', 'full'];

      for (const size of sizes) {
        const result = createWidgetSchema.safeParse({
          widget_type: 'pipeline_chart',
          size,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid widget_type', () => {
      const input = { widget_type: 'invalid_widget' };

      const result = createWidgetSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateWidgetSchema', () => {
    it('should validate partial updates', () => {
      const input = {
        position: 5,
        size: 'small',
      };

      const result = updateWidgetSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow empty update', () => {
      const input = {};

      const result = updateWidgetSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate config updates', () => {
      const input = {
        config: {
          title: 'Updated Title',
          time_range: 'week',
        },
      };

      const result = updateWidgetSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject negative position', () => {
      const input = { position: -1 };

      const result = updateWidgetSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('widgetQuerySchema', () => {
    it('should parse valid query', () => {
      const input = {
        widget_type: 'pipeline_chart',
        is_visible: 'true',
      };

      const result = widgetQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.widget_type).toBe('pipeline_chart');
        expect(result.data.is_visible).toBe(true);
      }
    });

    it('should allow empty query', () => {
      const input = {};

      const result = widgetQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('dateRangeQuerySchema', () => {
    it('should validate date range', () => {
      const input = {
        start_date: '2024-01-01T00:00:00Z',
        end_date: '2024-12-31T23:59:59Z',
      };

      const result = dateRangeQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow empty query', () => {
      const input = {};

      const result = dateRangeQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const input = {
        start_date: '2024-01-01',
        end_date: 'invalid',
      };

      const result = dateRangeQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('metricsQuerySchema', () => {
    it('should parse valid query', () => {
      const input = {
        start_date: '2024-01-01T00:00:00Z',
        end_date: '2024-12-31T23:59:59Z',
        group_by: 'week',
      };

      const result = metricsQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.group_by).toBe('week');
      }
    });

    it('should use default group_by', () => {
      const input = {};

      const result = metricsQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.group_by).toBe('month');
      }
    });

    it('should accept all valid group_by values', () => {
      const values = ['day', 'week', 'month'];

      for (const group_by of values) {
        const result = metricsQuerySchema.safeParse({ group_by });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid group_by', () => {
      const input = { group_by: 'year' };

      const result = metricsQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
