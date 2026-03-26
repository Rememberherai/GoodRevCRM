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

// Date fields that need YYYY-MM-DD format
const DATE_FIELDS = new Set([
  'loi_due_at', 'application_due_at', 'report_due_at',
  'award_period_start', 'award_period_end', 'closeout_date',
]);

// Fields that may have currency formatting ($50,000)
const CURRENCY_FIELDS = new Set([
  'amount_requested', 'amount_awarded', 'funding_range_min',
  'funding_range_max', 'total_award_amount', 'match_required',
]);

// Excel serial date epoch (Jan 1 1900, with Lotus 1-2-3 leap year bug)
function excelSerialToDateStr(serial: number): string {
  const utc = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return utc.toISOString().slice(0, 10);
}

function normalizeCell(value: unknown, fieldName: string): string {
  if (value == null) return '';

  // Excel Date object (when cellDates: true)
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  // Excel serial number for date fields
  if (DATE_FIELDS.has(fieldName) && typeof value === 'number') {
    return excelSerialToDateStr(value);
  }

  const str = String(value).trim();

  // Strip currency formatting for numeric fields
  if (CURRENCY_FIELDS.has(fieldName)) {
    return str.replace(/[$,]/g, '');
  }

  return str;
}

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
          i++;
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

  const parseFile = async (file: File): Promise<{ headers: string[]; rows: string[][] }> => {
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel';

    if (isXlsx) {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('No sheets found in workbook');
      const sheet = workbook.Sheets[sheetName]!;
      // header: 1 returns array-of-arrays; raw: false formats dates as strings
      const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

      if (data.length < 2) throw new Error('Spreadsheet must have a header row and at least one data row');

      const headers = (data[0] as unknown[]).map(h => String(h ?? '').trim());
      const rows = data.slice(1).map(row =>
        headers.map((_, i) => String((row as unknown[])[i] ?? '').trim())
      );
      return { headers, rows };
    } else {
      // CSV
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');
      const headers = parseCsvLine(lines[0] ?? '');
      const rows = lines.slice(1).map(line => parseCsvLine(line));
      return { headers, rows };
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    try {
      const { headers, rows } = await parseFile(selectedFile);
      setCsvHeaders(headers);
      setCsvRows(rows);

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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to parse file');
      // Reset file input so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setStep('importing');

    try {
      // Build mapped rows, applying per-field normalization
      const rows = csvRows.map(row => {
        const mapped: Record<string, string> = {};
        csvHeaders.forEach((header, idx) => {
          const fieldName = mapping[header];
          if (fieldName) {
            const raw = row[idx] ?? '';
            const normalized = normalizeCell(raw, fieldName);
            if (normalized !== '') {
              mapped[fieldName] = normalized;
            }
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const mappedFieldCount = Object.values(mapping).filter(Boolean).length;
  const hasNameMapped = Object.values(mapping).includes('name');

  const downloadTemplate = () => {
    const headers = grantFields.map(f => f.label).join(',');
    // One example value per field — order matches grantFields definition
    const exampleRow = [
      // Core fields
      'Community Youth Grant',          // name
      'researching',                    // status
      'foundation',                     // category
      '50000',                          // amount_requested
      '',                               // amount_awarded
      '25000',                          // funding_range_min
      '75000',                          // funding_range_max
      'Ford Foundation',                // funder_name
      '4',                              // mission_fit (1-5)
      '1',                              // tier (1-3)
      'high',                           // urgency
      '2026-06-01',                     // loi_due_at
      '2026-07-15',                     // application_due_at
      '',                               // report_due_at
      'https://www.fordfoundation.org/apply', // application_url
      'New program officer is Jane Smith. Focus shifted to environmental justice in 2025.', // key_intel
      'Submit LOI by June. Leverage board connection with Jane.', // recommended_strategy
      'Supports youth mentorship programs', // notes
      // Post-award fields
      '',                               // award_number
      '',                               // funder_grant_id
      '',                               // award_period_start
      '',                               // award_period_end
      '',                               // total_award_amount
      '',                               // match_required
      '',                               // match_type
      '',                               // indirect_cost_rate
      '',                               // agreement_status
      '',                               // closeout_date
      '',                               // source_url
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
            {step === 'upload' && 'Upload a CSV or Excel file with grant data.'}
            {step === 'mapping' && `Map columns to grant fields. ${csvRows.length} rows detected.`}
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
              <p className="text-sm font-medium">Click to upload CSV or Excel file</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports .csv, .xlsx, .xls — download the template for all supported columns.
              </p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={downloadTemplate}>
              <Download className="h-3 w-3" />
              Download template CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
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
