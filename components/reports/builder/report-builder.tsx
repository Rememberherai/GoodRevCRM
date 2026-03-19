'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Play,
  Loader2,
  Database,
  Columns,
  Filter,
  Layers,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useReportSchema } from '@/hooks/use-report-schema';
import { useReportBuilderStore } from '@/stores/report-builder';
import { ObjectPicker } from './object-picker';
import { FieldSelector } from './field-selector';
import { FilterBuilder } from './filter-builder';
import { GroupAggregate } from './group-aggregate';
import { ChartConfigPanel } from './chart-config';
import { ReportPreview } from './report-preview';
import { TemplatePicker } from './template-picker';
import type { ReportColumn } from '@/lib/reports/types';
import type { ReportTemplate } from '@/lib/reports/report-templates';

interface ReportBuilderProps {
  projectSlug: string;
  editReportId?: string;
}

const STEPS = [
  { key: 'source', label: 'Data Source', icon: Database },
  { key: 'fields', label: 'Fields', icon: Columns },
  { key: 'filters', label: 'Filters', icon: Filter },
  { key: 'grouping', label: 'Grouping', icon: Layers },
  { key: 'visualization', label: 'Visualization', icon: BarChart3 },
];

export function ReportBuilder({ projectSlug, editReportId }: ReportBuilderProps) {
  const router = useRouter();
  const { data: schema, isLoading: schemaLoading } = useReportSchema(projectSlug);

  const [showTemplates, setShowTemplates] = React.useState(!editReportId);

  const store = useReportBuilderStore();
  const {
    step,
    primaryObject,
    columns,
    filters,
    groupBy,
    aggregations,
    chartType,
    chartConfig,
    reportName,
    reportDescription,
    isPublic,
    previewResult,
    previewLoading,
    previewError,
    saving,
  } = store;

  // Load existing report for editing
  React.useEffect(() => {
    if (editReportId) {
      fetch(`/api/projects/${projectSlug}/reports?limit=100`)
        .then((res) => res.json())
        .then((json) => {
          const report = (json.data ?? []).find(
            (r: { id: string }) => r.id === editReportId
          );
          if (report?.config?.primaryObject) {
            store.loadFromConfig(report.config, report.name, report.description);
          }
        })
        .catch(() => {});
    }
    // Reset store on unmount
    return () => {
      if (!editReportId) store.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editReportId, projectSlug]);

  // Auto-preview when config changes
  const runPreview = React.useCallback(async () => {
    const config = store.buildConfig();
    if (!config) return;

    store.setPreviewLoading(true);
    store.setPreviewError(null);

    try {
      const res = await fetch(`/api/projects/${projectSlug}/reports/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const err = await res.json();
        store.setPreviewError(err.error ?? 'Preview failed');
        store.setPreviewResult(null);
      } else {
        const data = await res.json();
        store.setPreviewResult(data);
      }
    } catch {
      store.setPreviewError('Network error');
    } finally {
      store.setPreviewLoading(false);
    }
  }, [projectSlug, store]);

  const handleSave = async () => {
    const config = store.buildConfig();
    if (!config || !reportName.trim()) return;

    store.setSaving(true);

    try {
      const endpoint = editReportId
        ? `/api/projects/${projectSlug}/reports/${editReportId}`
        : `/api/projects/${projectSlug}/reports`;
      const method = editReportId ? 'PUT' : 'POST';

      const body = editReportId
        ? { name: reportName, description: reportDescription || null, config, is_public: isPublic }
        : {
            name: reportName,
            description: reportDescription || null,
            report_type: 'custom',
            config,
            is_public: isPublic,
          };

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        store.setSavedReportId(data.id ?? editReportId);
        router.push(`/projects/${projectSlug}/reports`);
      }
    } catch {
      // Error handled by user seeing they're still on the page
    } finally {
      store.setSaving(false);
    }
  };

  const handleToggleColumn = (column: ReportColumn) => {
    const existing = columns.findIndex(
      (c) => c.objectName === column.objectName && c.fieldName === column.fieldName
    );
    if (existing >= 0) {
      store.removeColumn(existing);
      // Also remove any orphaned aggregation for this field
      store.removeFieldAggregation(column.objectName, column.fieldName);
    } else {
      store.addColumn(column);
    }
  };

  const handleSelectTemplate = (template: ReportTemplate) => {
    store.setSkipDefaults(false);
    store.loadFromConfig(template.config, template.name, '');
    setShowTemplates(false);
  };

  const handleStartFromScratch = () => {
    store.setSkipDefaults(true);
    setShowTemplates(false);
  };

  if (schemaLoading || !schema) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading report schema...</span>
      </div>
    );
  }

  const canProceed = (() => {
    switch (step) {
      case 0:
        return !!primaryObject;
      case 1:
        return columns.length > 0;
      default:
        return true;
    }
  })();

  const primaryObj = primaryObject ? schema.objects[primaryObject] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {editReportId ? 'Edit Report' : 'Custom Report Builder'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Build a report on any object with custom fields, filters, and aggregations.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => router.push(`/projects/${projectSlug}/reports`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back
        </Button>
      </div>

      {showTemplates ? (
        <TemplatePicker
          onSelectTemplate={handleSelectTemplate}
          onStartFromScratch={handleStartFromScratch}
        />
      ) : (
      <>
      {/* Step indicators */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              i === step
                ? 'bg-primary text-primary-foreground'
                : i < step
                  ? 'bg-primary/10 text-primary hover:bg-primary/20'
                  : 'text-muted-foreground hover:bg-muted/50'
            }`}
            onClick={() => store.setStep(i)}
          >
            <s.icon className="h-4 w-4" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Left: Builder step */}
        <div className="min-w-0">
          {step === 0 && (
            <ObjectPicker
              objects={schema.objects}
              selectedObject={primaryObject}
              onSelect={(obj) => {
                store.setPrimaryObject(obj);
                if (schema) store.applySmartDefaults(obj, schema);
              }}
            />
          )}

          {step === 1 && primaryObj && (
            <FieldSelector
              primaryObject={primaryObj}
              allObjects={schema.objects}
              selectedColumns={columns}
              onToggleColumn={handleToggleColumn}
              aggregations={groupBy.length > 0 ? aggregations : undefined}
              onSetFieldAggregation={groupBy.length > 0 ? store.setFieldAggregation : undefined}
              onRemoveFieldAggregation={groupBy.length > 0 ? store.removeFieldAggregation : undefined}
            />
          )}

          {step === 2 && primaryObj && (
            <FilterBuilder
              primaryObject={primaryObj}
              allObjects={schema.objects}
              filters={filters}
              onAddFilter={store.addFilter}
              onRemoveFilter={store.removeFilter}
              onUpdateFilter={store.updateFilter}
            />
          )}

          {step === 3 && primaryObj && (
            <GroupAggregate
              primaryObject={primaryObj}
              allObjects={schema.objects}
              groupBy={groupBy}
              aggregations={aggregations}
              onAddGroupBy={store.addGroupBy}
              onRemoveGroupBy={store.removeGroupBy}
              onAddAggregation={store.addAggregation}
              onRemoveAggregation={store.removeAggregation}
              onUpdateAggregation={store.updateAggregation}
            />
          )}

          {step === 4 && (
            <div className="space-y-6">
              <ChartConfigPanel
                chartType={chartType}
                chartConfig={chartConfig}
                columns={columns}
                groupBy={groupBy}
                aggregations={aggregations}
                onChartTypeChange={store.setChartType}
                onChartConfigChange={store.setChartConfig}
              />

              {/* Save configuration */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold">Save Report</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Report Name</Label>
                    <Input
                      value={reportName}
                      onChange={(e) => store.setReportName(e.target.value)}
                      placeholder="e.g., Q1 Pipeline by Stage"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={reportDescription}
                      onChange={(e) => store.setReportDescription(e.target.value)}
                      placeholder="Optional description"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isPublic}
                    onCheckedChange={store.setIsPublic}
                  />
                  <Label className="text-sm">
                    Public (visible to all project members)
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={store.prevStep}
              disabled={step === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Previous
            </Button>

            <div className="flex items-center gap-2">
              {columns.length > 0 && (
                <Button
                  variant="outline"
                  onClick={runPreview}
                  disabled={previewLoading}
                >
                  <Play className="h-4 w-4 mr-1.5" />
                  Preview
                </Button>
              )}

              {step < STEPS.length - 1 ? (
                <Button onClick={store.nextStep} disabled={!canProceed}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              ) : (
                <Button
                  onClick={handleSave}
                  disabled={saving || !reportName.trim() || columns.length === 0}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" />
                  )}
                  {editReportId ? 'Update Report' : 'Save Report'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="min-w-0">
          <ReportPreview
            result={previewResult}
            loading={previewLoading}
            error={previewError}
            chartType={chartType}
            chartConfig={chartConfig}
            aggregations={aggregations}
            onRefresh={runPreview}
          />
        </div>
      </div>
      </>
      )}
    </div>
  );
}
