'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Upload, FileText, Check, AlertCircle, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { grantFields } from '@/types/import-export';

interface GrantImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

type Step = 'upload' | 'mapping' | 'importing' | 'complete';

export function GrantImportDialog({ open, onOpenChange, onImported }: GrantImportDialogProps) {
  const { slug } = useParams<{ slug: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [_file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [_importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    successful: number;
    failed: number;
    results: { row: number; success: boolean; error?: string }[];
  } | null>(null);

  // Parse a single CSV line respecting quoted fields with commas
  const parseCsvLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const text = await selectedFile.text();
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    if (lines.length < 2) {
      toast.error('CSV must have a header row and at least one data row');
      return;
    }

    const headers = parseCsvLine(lines[0] ?? '');
    setCsvHeaders(headers);

    // Parse data rows
    const dataRows = lines.slice(1).map(line => parseCsvLine(line));
    setCsvRows(dataRows);

    // Auto-map matching headers
    const autoMapping: Record<string, string> = {};
    for (const header of headers) {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const matchedField = grantFields.find(f =>
        f.name === normalizedHeader ||
        f.label.toLowerCase().replace(/[^a-z0-9]/g, '_') === normalizedHeader
      );
      if (matchedField) {
        autoMapping[header] = matchedField.name;
      }
    }
    setMapping(autoMapping);
    setStep('mapping');
  };

  const handleImport = async () => {
    setImporting(true);
    setStep('importing');

    try {
      // Build mapped rows
      const rows = csvRows.map(row => {
        const mapped: Record<string, string> = {};
        csvHeaders.forEach((header, idx) => {
          const fieldName = mapping[header];
          if (fieldName && row[idx]) {
            mapped[fieldName] = row[idx];
          }
        });
        return mapped;
      }).filter(row => row.name);

      if (rows.length === 0) {
        toast.error('No valid rows to import. Make sure "name" is mapped.');
        setStep('mapping');
        setImporting(false);
        return;
      }

      const res = await fetch(`/api/projects/${slug}/grants/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Import failed');
      }

      const data = await res.json();

      setResult(data);
      setStep('complete');
      toast.success(`Imported ${data.successful} of ${data.total} grants`);
      onImported();
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error instanceof Error ? error.message : 'Import failed');
      setStep('mapping');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep('upload');
    setFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setMapping({});
    setResult(null);
  };

  const mappedFieldCount = Object.values(mapping).filter(Boolean).length;
  const hasNameMapped = Object.values(mapping).includes('name');

  const downloadTemplate = () => {
    const headers = grantFields.map(f => f.label).join(',');
    const exampleRow = [
      'Community Youth Grant',
      'researching',
      '50000',
      '',
      'Ford Foundation',
      '2026-06-01',
      '2026-07-15',
      '',
      'Supports youth mentorship programs',
    ].join(',');
    const csv = `${headers}\n${exampleRow}\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grants-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import Grants</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV file with grant data.'}
            {step === 'mapping' && `Map CSV columns to grant fields. ${csvRows.length} rows detected.`}
            {step === 'importing' && 'Importing grants...'}
            {step === 'complete' && 'Import complete.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Click to upload CSV</p>
              <p className="text-xs text-muted-foreground mt-1">
                Columns: Name (required), Status, Amount Requested, Amount Awarded, Funder Organization, LOI Due Date, Application Due Date, Report Due Date, Notes
              </p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={downloadTemplate}>
              <Download className="h-3 w-3" />
              Download template CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {csvHeaders.map(header => (
              <div key={header} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-40 shrink-0">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <Label className="text-sm truncate" title={header}>{header}</Label>
                </div>
                <span className="text-muted-foreground text-xs">&rarr;</span>
                <Select
                  value={mapping[header] || '_skip'}
                  onValueChange={v => setMapping(prev => ({ ...prev, [header]: v === '_skip' ? '' : v }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Skip this column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_skip">Skip this column</SelectItem>
                    {grantFields.map(field => (
                      <SelectItem key={field.name} value={field.name}>
                        {field.label} {field.required ? '*' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-2">
              {mappedFieldCount} column{mappedFieldCount !== 1 ? 's' : ''} mapped.
              {!hasNameMapped && (
                <span className="text-destructive ml-1">Grant Name must be mapped.</span>
              )}
            </p>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importing {csvRows.length} grants...</p>
          </div>
        )}

        {step === 'complete' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10">
              <Check className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">{result.successful} of {result.total} grants imported</p>
                {result.failed > 0 && (
                  <p className="text-sm text-muted-foreground">{result.failed} failed</p>
                )}
              </div>
            </div>
            {result.results.filter(r => !r.success).length > 0 && (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {result.results.filter(r => !r.success).map(r => (
                  <div key={r.row} className="flex items-start gap-2 text-xs">
                    <AlertCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                    <span>Row {r.row}: {r.error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleImport} disabled={!hasNameMapped}>
                Import {csvRows.length} Grant{csvRows.length !== 1 ? 's' : ''}
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
