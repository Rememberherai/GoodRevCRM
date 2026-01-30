'use client';

import { useState } from 'react';
import { Download, Check, FileSpreadsheet, FileJson, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  ImportExportEntityType,
  ExportFormat,
  FieldDefinition,
} from '@/types/import-export';
import {
  personFields,
  organizationFields,
  opportunityFields,
  taskFields,
} from '@/types/import-export';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  defaultEntityType?: ImportExportEntityType;
}

const entityFieldMap: Record<ImportExportEntityType, FieldDefinition[]> = {
  person: personFields,
  organization: organizationFields,
  opportunity: opportunityFields,
  task: taskFields,
};

const formatIcons: Record<ExportFormat, typeof FileText> = {
  csv: FileText,
  xlsx: FileSpreadsheet,
  json: FileJson,
};

export function ExportDialog({
  open,
  onOpenChange,
  projectSlug,
  defaultEntityType = 'person',
}: ExportDialogProps) {
  const [entityType, setEntityType] = useState<ImportExportEntityType>(defaultEntityType);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const fields = entityFieldMap[entityType] || [];

  const handleColumnToggle = (column: string) => {
    setSelectedColumns((prev) =>
      prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column]
    );
  };

  const handleSelectAll = () => {
    if (selectedColumns.length === fields.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns(fields.map((f) => f.name));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);
    setDownloadUrl(null);

    try {
      // Create export job
      const response = await fetch(`/api/projects/${projectSlug}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          format,
          columns: selectedColumns.length > 0 ? selectedColumns : fields.map((f) => f.name),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create export job');
      }

      // Simulate processing
      for (let i = 0; i <= 100; i += 20) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setProgress(i);
      }

      // In a real implementation, this would be the actual download URL
      setDownloadUrl(`/api/projects/${projectSlug}/export/download?format=${format}`);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      // In a real implementation, this would trigger the actual download
      window.open(downloadUrl, '_blank');
      onOpenChange(false);
    }
  };

  const resetDialog = () => {
    setProgress(0);
    setDownloadUrl(null);
    setExporting(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) resetDialog();
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>
            Export your data to a file for backup or use in other tools.
          </DialogDescription>
        </DialogHeader>

        {!downloadUrl ? (
          <div className="space-y-4">
            <div>
              <Label>Entity Type</Label>
              <Select
                value={entityType}
                onValueChange={(v) => {
                  setEntityType(v as ImportExportEntityType);
                  setSelectedColumns([]);
                }}
                disabled={exporting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">People</SelectItem>
                  <SelectItem value="organization">Organizations</SelectItem>
                  <SelectItem value="opportunity">Opportunities</SelectItem>
                  <SelectItem value="task">Tasks</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Format</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {(['csv', 'xlsx', 'json'] as ExportFormat[]).map((f) => {
                  const Icon = formatIcons[f];
                  return (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      disabled={exporting}
                      className={`p-3 border rounded-lg flex flex-col items-center gap-1 transition-colors ${
                        format === f
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs uppercase">{f}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Columns</Label>
                <Button variant="ghost" size="sm" onClick={handleSelectAll} disabled={exporting}>
                  {selectedColumns.length === fields.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-3">
                {fields.map((field) => (
                  <div key={field.name} className="flex items-center gap-2">
                    <Checkbox
                      id={field.name}
                      checked={
                        selectedColumns.length === 0 || selectedColumns.includes(field.name)
                      }
                      onCheckedChange={() => handleColumnToggle(field.name)}
                      disabled={exporting}
                    />
                    <Label htmlFor={field.name} className="text-sm font-normal cursor-pointer">
                      {field.label}
                    </Label>
                  </div>
                ))}
              </div>
              {selectedColumns.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  All columns will be exported if none are selected
                </p>
              )}
            </div>

            {exporting && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">Preparing export...</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={exporting}>
                {exporting ? 'Exporting...' : 'Export'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium">Export Ready</h3>
              <p className="text-sm text-muted-foreground">
                Your export is ready to download.
              </p>
            </div>

            <Button onClick={handleDownload} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download {format.toUpperCase()}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
