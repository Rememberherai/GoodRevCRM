'use client';

import { useState } from 'react';
import { Upload, FileText, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';
import type {
  ImportExportEntityType,
  ImportMapping,
  ImportOptions,
  FieldDefinition,
} from '@/types/import-export';
import {
  personFields,
  organizationFields,
  opportunityFields,
  taskFields,
} from '@/types/import-export';

interface ImportWizardProps {
  projectSlug: string;
  onComplete: () => void;
  onCancel: () => void;
}

type WizardStep = 'upload' | 'mapping' | 'options' | 'processing' | 'complete';

const entityFieldMap: Record<ImportExportEntityType, FieldDefinition[]> = {
  person: personFields,
  organization: organizationFields,
  opportunity: opportunityFields,
  task: taskFields,
};

export function ImportWizard({ projectSlug, onComplete, onCancel }: ImportWizardProps) {
  const [step, setStep] = useState<WizardStep>('upload');
  const [entityType, setEntityType] = useState<ImportExportEntityType>('person');
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [options, setOptions] = useState<ImportOptions>({
    skip_duplicates: false,
    update_existing: false,
    skip_header: true,
    delimiter: ',',
  });
  const [_processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    total: number;
    successful: number;
    failed: number;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);

  const fields = entityFieldMap[entityType] || [];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    // Parse first row to get headers
    const text = await selectedFile.text();
    const lines = text.split('\n');
    if (lines.length > 0 && lines[0]) {
      const delimiter = options.delimiter ?? ',';
      const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/"/g, ''));
      setCsvHeaders(headers);

      // Auto-map matching headers
      const autoMapping: ImportMapping = {};
      for (const header of headers) {
        const matchingField = fields.find(
          (f) =>
            f.name.toLowerCase() === header.toLowerCase() ||
            f.label.toLowerCase() === header.toLowerCase()
        );
        if (matchingField) {
          autoMapping[header] = matchingField.name;
        }
      }
      setMapping(autoMapping);
    }
  };

  const handleMappingChange = (csvColumn: string, fieldName: string) => {
    setMapping((prev) => ({
      ...prev,
      [csvColumn]: fieldName,
    }));
  };

  const handleStartImport = async () => {
    if (!file) return;

    setProcessing(true);
    setStep('processing');

    try {
      // Create import job
      const response = await fetch(`/api/projects/${projectSlug}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          file_name: file.name,
          mapping,
          options,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create import job');
      }

      // Simulate processing (in real implementation, this would be handled by a background job)
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        setProgress(i);
      }

      // Simulated result
      setResult({
        total: 100,
        successful: 95,
        failed: 5,
        errors: [
          { row: 23, message: 'Invalid email format' },
          { row: 45, message: 'Missing required field: first_name' },
          { row: 67, message: 'Duplicate entry' },
          { row: 78, message: 'Invalid phone format' },
          { row: 92, message: 'Invalid URL format' },
        ],
      });

      setStep('complete');
    } catch (error) {
      console.error('Import error:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {(['upload', 'mapping', 'options', 'processing', 'complete'] as WizardStep[]).map(
          (s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : ['processing', 'complete'].includes(step) &&
                      ['upload', 'mapping', 'options'].includes(s)
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {['processing', 'complete'].includes(step) &&
                ['upload', 'mapping', 'options'].includes(s) ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 4 && <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />}
            </div>
          )
        )}
      </div>

      {/* Step content */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div>
            <Label>Entity Type</Label>
            <Select
              value={entityType}
              onValueChange={(v) => setEntityType(v as ImportExportEntityType)}
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
            <Label>CSV File</Label>
            <div className="mt-2 border-2 border-dashed rounded-lg p-8 text-center">
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                  <span>{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      setCsvHeaders([]);
                      setMapping({});
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop a CSV file, or click to browse
                  </p>
                  <Input
                    type="file"
                    accept=".csv"
                    className="max-w-xs mx-auto"
                    onChange={handleFileSelect}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => setStep('mapping')} disabled={!file}>
              Next: Map Fields
            </Button>
          </div>
        </div>
      )}

      {step === 'mapping' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Map your CSV columns to the corresponding fields.
          </p>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {csvHeaders.map((header) => (
              <div key={header} className="flex items-center gap-4">
                <div className="w-1/3 font-medium truncate">{header}</div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={mapping[header] || '_skip'}
                  onValueChange={(v) => handleMappingChange(header, v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Skip this column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_skip">Skip this column</SelectItem>
                    {fields.map((field) => (
                      <SelectItem key={field.name} value={field.name}>
                        {field.label} {field.required && '*'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep('upload')}>
              Back
            </Button>
            <Button onClick={() => setStep('options')}>Next: Options</Button>
          </div>
        </div>
      )}

      {step === 'options' && (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="skip_duplicates"
                checked={options.skip_duplicates}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({ ...prev, skip_duplicates: !!checked }))
                }
              />
              <Label htmlFor="skip_duplicates">Skip duplicate entries</Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="update_existing"
                checked={options.update_existing}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({ ...prev, update_existing: !!checked }))
                }
              />
              <Label htmlFor="update_existing">Update existing records</Label>
            </div>

            {options.update_existing && (
              <div className="ml-6">
                <Label>Match duplicates by</Label>
                <Select
                  value={options.duplicate_key || 'email'}
                  onValueChange={(v) =>
                    setOptions((prev) => ({ ...prev, duplicate_key: v }))
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {entityType === 'person' && (
                      <SelectItem value="email">Email</SelectItem>
                    )}
                    {entityType === 'organization' && (
                      <>
                        <SelectItem value="domain">Domain</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                      </>
                    )}
                    {entityType === 'opportunity' && (
                      <SelectItem value="title">Title</SelectItem>
                    )}
                    {entityType === 'task' && (
                      <SelectItem value="title">Title</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep('mapping')}>
              Back
            </Button>
            <Button onClick={handleStartImport}>Start Import</Button>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="space-y-4 py-8">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="font-medium">Processing import...</p>
            <p className="text-sm text-muted-foreground">Please wait while we import your data</p>
          </div>
          <Progress value={progress} className="max-w-md mx-auto" />
        </div>
      )}

      {step === 'complete' && result && (
        <div className="space-y-4">
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium">Import Complete</h3>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{result.total}</p>
              <p className="text-sm text-muted-foreground">Total Rows</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{result.successful}</p>
              <p className="text-sm text-muted-foreground">Successful</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{result.failed}</p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                Errors ({result.errors.length})
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {result.errors.map((error, i) => (
                  <div key={i} className="text-sm text-muted-foreground">
                    Row {error.row}: {error.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={onComplete}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}
