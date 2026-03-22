import { create } from 'zustand';
import type {
  CustomReportConfig,
  ReportColumn,
  ReportFilter,
  ReportAggregation,
  ReportOrderBy,
  CustomChartType,
  ChartConfig,
  CustomReportResult,
  ReportSchema,
  AggregationFunction,
} from '@/lib/reports/types';
import { getSmartDefaults } from '@/lib/reports/report-templates';

// ── Store Types ─────────────────────────────────────────────────────────────

interface ReportBuilderState {
  // Builder step
  step: number;

  // Report metadata
  reportName: string;
  reportDescription: string;
  isPublic: boolean;

  // Config
  primaryObject: string | null;
  columns: ReportColumn[];
  filters: ReportFilter[];
  groupBy: string[];
  aggregations: ReportAggregation[];
  orderBy: ReportOrderBy[];
  limit: number;
  chartType: CustomChartType;
  chartConfig: ChartConfig;

  // Preview state
  previewResult: CustomReportResult | null;
  previewLoading: boolean;
  previewError: string | null;

  // Saving state
  saving: boolean;
  savedReportId: string | null;

  // Internal flags
  _skipDefaults: boolean;

  // Actions
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  setReportName: (name: string) => void;
  setReportDescription: (desc: string) => void;
  setIsPublic: (isPublic: boolean) => void;

  setPrimaryObject: (objectName: string) => void;

  addColumn: (column: ReportColumn) => void;
  removeColumn: (index: number) => void;
  updateColumn: (index: number, column: ReportColumn) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  clearColumns: () => void;

  addFilter: (filter: ReportFilter) => void;
  removeFilter: (index: number) => void;
  updateFilter: (index: number, filter: ReportFilter) => void;

  setGroupBy: (fields: string[]) => void;
  addGroupBy: (field: string) => void;
  removeGroupBy: (field: string) => void;

  addAggregation: (agg: ReportAggregation) => void;
  removeAggregation: (index: number) => void;
  updateAggregation: (index: number, agg: ReportAggregation) => void;

  setOrderBy: (orderBy: ReportOrderBy[]) => void;
  setLimit: (limit: number) => void;
  setChartType: (chartType: CustomChartType) => void;
  setChartConfig: (config: ChartConfig) => void;

  setPreviewResult: (result: CustomReportResult | null) => void;
  setPreviewLoading: (loading: boolean) => void;
  setPreviewError: (error: string | null) => void;

  setSaving: (saving: boolean) => void;
  setSavedReportId: (id: string | null) => void;

  // Build the config object
  buildConfig: () => CustomReportConfig | null;

  // Load from existing report
  loadFromConfig: (config: CustomReportConfig, name?: string, description?: string) => void;

  // Smart defaults & inline aggregation
  applySmartDefaults: (objectName: string, schema: ReportSchema) => void;
  setSkipDefaults: (skip: boolean) => void;
  setFieldAggregation: (objectName: string, fieldName: string, fn: AggregationFunction) => void;
  removeFieldAggregation: (objectName: string, fieldName: string) => void;

  // Reset everything
  reset: () => void;
}

// ── Initial State ───────────────────────────────────────────────────────────

const initialState = {
  step: 0,
  reportName: '',
  reportDescription: '',
  isPublic: false,
  primaryObject: null as string | null,
  columns: [] as ReportColumn[],
  filters: [] as ReportFilter[],
  groupBy: [] as string[],
  aggregations: [] as ReportAggregation[],
  orderBy: [] as ReportOrderBy[],
  limit: 500,
  chartType: 'table' as CustomChartType,
  chartConfig: {} as ChartConfig,
  previewResult: null as CustomReportResult | null,
  previewLoading: false,
  previewError: null as string | null,
  saving: false,
  savedReportId: null as string | null,
  _skipDefaults: false,
};

// ── Store ────────────────────────────────────────────────────────────────────

export const useReportBuilderStore = create<ReportBuilderState>((set, get) => ({
  ...initialState,

  // Step navigation
  setStep: (step) => set({ step }),
  nextStep: () => set((s) => ({ step: Math.min(s.step + 1, 4) })),
  prevStep: () => set((s) => ({ step: Math.max(s.step - 1, 0) })),

  // Metadata
  setReportName: (reportName) => set({ reportName }),
  setReportDescription: (reportDescription) => set({ reportDescription }),
  setIsPublic: (isPublic) => set({ isPublic }),

  // Primary object — reset dependent state when changed
  setPrimaryObject: (primaryObject) =>
    set({
      primaryObject,
      columns: [],
      filters: [],
      groupBy: [],
      aggregations: [],
      orderBy: [],
      previewResult: null,
      previewError: null,
    }),

  // Columns
  addColumn: (column) => set((s) => ({ columns: [...s.columns, column] })),
  removeColumn: (index) =>
    set((s) => ({ columns: s.columns.filter((_, i) => i !== index) })),
  updateColumn: (index, column) =>
    set((s) => ({
      columns: s.columns.map((c, i) => (i === index ? column : c)),
    })),
  reorderColumns: (fromIndex, toIndex) =>
    set((s) => {
      const cols = [...s.columns];
      const [moved] = cols.splice(fromIndex, 1);
      cols.splice(toIndex, 0, moved!);
      return { columns: cols };
    }),
  clearColumns: () => set({ columns: [] }),

  // Filters
  addFilter: (filter) => set((s) => ({ filters: [...s.filters, filter] })),
  removeFilter: (index) =>
    set((s) => ({ filters: s.filters.filter((_, i) => i !== index) })),
  updateFilter: (index, filter) =>
    set((s) => ({
      filters: s.filters.map((f, i) => (i === index ? filter : f)),
    })),

  // Group by
  setGroupBy: (groupBy) => set({ groupBy }),
  addGroupBy: (field) =>
    set((s) => {
      if (s.groupBy.includes(field)) return s;
      const newGroupBy = [...s.groupBy, field];
      const hasCount = s.aggregations.some((a) => a.function === 'count');
      if (hasCount || !s.primaryObject) {
        return { groupBy: newGroupBy };
      }
      return {
        groupBy: newGroupBy,
        aggregations: [
          ...s.aggregations,
          { objectName: s.primaryObject, fieldName: 'id', function: 'count' as const, alias: 'record_count' },
        ],
      };
    }),
  removeGroupBy: (field) =>
    set((s) => {
      const newGroupBy = s.groupBy.filter((f) => f !== field);
      // Clear aggregations and orderBy when last groupBy is removed (aggregations without groupBy are invalid)
      if (newGroupBy.length === 0) {
        return { groupBy: newGroupBy, aggregations: [], orderBy: [] };
      }
      // Remove any orderBy entries that reference the removed groupBy field
      const newOrderBy = s.orderBy.filter((o) => o.field !== field);
      return { groupBy: newGroupBy, orderBy: newOrderBy };
    }),

  // Aggregations
  addAggregation: (agg) =>
    set((s) => ({ aggregations: [...s.aggregations, agg] })),
  removeAggregation: (index) =>
    set((s) => {
      const removed = s.aggregations[index];
      const aggregations = s.aggregations.filter((_, i) => i !== index);
      // Clean up any orderBy referencing the removed aggregation's alias
      const orderBy = removed
        ? s.orderBy.filter((o) => o.field !== removed.alias)
        : s.orderBy;
      return { aggregations, orderBy };
    }),
  updateAggregation: (index, agg) =>
    set((s) => {
      const old = s.aggregations[index];
      const aggregations = s.aggregations.map((a, i) => (i === index ? agg : a));
      // If alias changed, update any orderBy referencing the old alias
      const orderBy = old && old.alias !== agg.alias
        ? s.orderBy.map((o) => o.field === old.alias ? { ...o, field: agg.alias } : o)
        : s.orderBy;
      return { aggregations, orderBy };
    }),

  // Order, limit, chart
  setOrderBy: (orderBy) => set({ orderBy }),
  setLimit: (limit) => set({ limit }),
  setChartType: (chartType) => set({ chartType }),
  setChartConfig: (chartConfig) => set({ chartConfig }),

  // Preview
  setPreviewResult: (previewResult) => set({ previewResult }),
  setPreviewLoading: (previewLoading) => set({ previewLoading }),
  setPreviewError: (previewError) => set({ previewError }),

  // Save
  setSaving: (saving) => set({ saving }),
  setSavedReportId: (savedReportId) => set({ savedReportId }),

  // Build config
  buildConfig: () => {
    const s = get();
    if (!s.primaryObject || s.columns.length === 0) return null;

    const config: CustomReportConfig = {
      primaryObject: s.primaryObject,
      columns: s.columns,
      filters: s.filters,
      chartType: s.chartType,
    };

    if (s.groupBy.length > 0) config.groupBy = s.groupBy;
    if (s.aggregations.length > 0) config.aggregations = s.aggregations;
    if (s.orderBy.length > 0) config.orderBy = s.orderBy;
    if (s.limit !== 500) config.limit = s.limit;
    if (Object.keys(s.chartConfig).length > 0) config.chartConfig = s.chartConfig;

    return config;
  },

  // Load from existing
  loadFromConfig: (config, name, description) =>
    set({
      primaryObject: config.primaryObject,
      columns: config.columns,
      filters: config.filters,
      groupBy: config.groupBy ?? [],
      aggregations: config.aggregations ?? [],
      orderBy: config.orderBy ?? [],
      limit: config.limit ?? 500,
      chartType: config.chartType ?? 'table',
      chartConfig: config.chartConfig ?? {},
      reportName: name ?? '',
      reportDescription: description ?? '',
      step: 1,
      previewResult: null,
      previewError: null,
    }),

  // Smart defaults
  applySmartDefaults: (objectName, schema) => {
    const s = get();
    if (s._skipDefaults) return;
    const defaults = getSmartDefaults(objectName, schema);
    set({
      columns: defaults.columns,
      groupBy: defaults.groupBy,
      aggregations: defaults.aggregations,
      chartType: defaults.chartType,
    });
  },

  setSkipDefaults: (skip) => set({ _skipDefaults: skip }),

  // Inline field aggregation
  setFieldAggregation: (objectName, fieldName, fn) =>
    set((s) => {
      const idx = s.aggregations.findIndex(
        (a) => a.objectName === objectName && a.fieldName === fieldName
      );
      const alias = `${fn}_${fieldName}`;
      if (idx >= 0) {
        const oldAlias = s.aggregations[idx]!.alias;
        const updated = [...s.aggregations];
        updated[idx] = { ...updated[idx]!, function: fn, alias };
        // Update orderBy if alias changed
        const orderBy = oldAlias !== alias
          ? s.orderBy.map((o) => o.field === oldAlias ? { ...o, field: alias } : o)
          : s.orderBy;
        return { aggregations: updated, orderBy };
      }
      return {
        aggregations: [
          ...s.aggregations,
          { objectName, fieldName, function: fn, alias },
        ],
      };
    }),

  removeFieldAggregation: (objectName, fieldName) =>
    set((s) => {
      // Collect aliases of aggregations being removed so we can clean orderBy
      const removedAliases = s.aggregations
        .filter((a) => a.objectName === objectName && a.fieldName === fieldName)
        .map((a) => a.alias);
      return {
        aggregations: s.aggregations.filter(
          (a) => !(a.objectName === objectName && a.fieldName === fieldName)
        ),
        orderBy: s.orderBy.filter((o) => !removedAliases.includes(o.field)),
      };
    }),

  // Reset
  reset: () => set(initialState),
}));
