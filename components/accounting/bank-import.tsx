'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

function parseCSVHeaderLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result.map((header) => header.replace(/^"|"$/g, ''));
}

interface BankImportProps {
  bankAccountId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BankImport({ bankAccountId, open, onClose, onSuccess }: BankImportProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [csvData, setCsvData] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [dateCol, setDateCol] = useState('');
  const [descCol, setDescCol] = useState('');
  const [amountMode, setAmountMode] = useState<'single' | 'split'>('single');
  const [amountCol, setAmountCol] = useState('');
  const [debitCol, setDebitCol] = useState('');
  const [creditCol, setCreditCol] = useState('');
  const [refCol, setRefCol] = useState('__none__');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [step, setStep] = useState<'paste' | 'map'>('paste');

  const handleParsePaste = () => {
    const lines = csvData.trim().split(/\r?\n/);
    if (lines.length < 2) {
      toast.error('CSV must have a header row and at least one data row');
      return;
    }

    // Parse header row
    const headerLine = lines[0]!;
    const cols = parseCSVHeaderLine(headerLine);
    setHeaders(cols);

    // Auto-detect columns
    let nextDateCol = '';
    let nextDescCol = '';
    let nextAmountCol = '';
    let nextDebitCol = '';
    let nextCreditCol = '';
    let nextRefCol = '__none__';

    for (const col of cols) {
      const lower = col.toLowerCase();
      if (!nextDateCol && (lower.includes('date') || lower === 'posted')) nextDateCol = col;
      if (!nextDescCol && (lower.includes('description') || lower.includes('memo') || lower.includes('payee'))) nextDescCol = col;
      if (!nextAmountCol && (lower.includes('amount') || lower.includes('total'))) nextAmountCol = col;
      if (!nextDebitCol && lower.includes('debit')) nextDebitCol = col;
      if (!nextCreditCol && (lower.includes('credit') || lower.includes('deposit'))) nextCreditCol = col;
      if (nextRefCol === '__none__' && (lower.includes('reference') || lower.includes('check') || lower.includes('ref'))) nextRefCol = col;
    }

    setDateCol(nextDateCol);
    setDescCol(nextDescCol);
    setAmountCol(nextAmountCol);
    setDebitCol(nextDebitCol);
    setCreditCol(nextCreditCol);
    setRefCol(nextRefCol);

    if (!nextAmountCol && (nextDebitCol || nextCreditCol)) {
      setAmountMode('split');
    } else {
      setAmountMode('single');
    }

    setStep('map');
  };

  const handleImport = async () => {
    const hasSingleAmount = amountMode === 'single' && !!amountCol;
    const hasSplitAmount = amountMode === 'split' && !!debitCol && !!creditCol;

    if (!dateCol || !descCol || (!hasSingleAmount && !hasSplitAmount)) {
      toast.error('Date, Description, and either Amount or both Debit/Credit columns are required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/accounting/bank-accounts/${bankAccountId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv_data: csvData,
          column_mapping: {
            date_column: dateCol,
            description_column: descCol,
            amount_column: amountMode === 'single' ? amountCol : undefined,
            debit_column: amountMode === 'split' ? debitCol : undefined,
            credit_column: amountMode === 'split' ? creditCol : undefined,
            reference_column: refCol === '__none__' ? undefined : refCol,
            date_format: dateFormat,
          },
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }

      const { summary } = await response.json();
      toast.success(`Imported ${summary.imported} transactions`);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep('paste');
    setCsvData('');
    setHeaders([]);
    setDateCol('');
    setDescCol('');
    setAmountMode('single');
    setAmountCol('');
    setDebitCol('');
    setCreditCol('');
    setRefCol('__none__');
    setDateFormat('YYYY-MM-DD');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 'paste' ? 'Import Bank Transactions' : 'Map CSV Columns'}
          </DialogTitle>
        </DialogHeader>

        {step === 'paste' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Paste CSV Data</Label>
              <Textarea
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                rows={10}
                placeholder="Date,Description,Amount,Reference&#10;2024-01-15,Deposit from client,1500.00,CHK-001&#10;..."
                className="font-mono text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Paste your bank statement CSV data including the header row.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleParsePaste} disabled={!csvData.trim()}>
                Next: Map Columns
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Found {headers.length} columns. Map them to the correct fields:
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date Column *</Label>
                <Select value={dateCol} onValueChange={setDateCol}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description Column *</Label>
              <Select value={descCol} onValueChange={setDescCol}>
                <SelectTrigger>
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount Format *</Label>
              <Select value={amountMode} onValueChange={(value: 'single' | 'split') => setAmountMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single Amount Column</SelectItem>
                  <SelectItem value="split">Separate Debit / Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {amountMode === 'single' ? (
              <div className="space-y-2">
                <Label>Amount Column *</Label>
                <Select value={amountCol} onValueChange={setAmountCol}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Debit Column *</Label>
                  <Select value={debitCol} onValueChange={setDebitCol}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Credit Column *</Label>
                  <Select value={creditCol} onValueChange={setCreditCol}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Reference Column</Label>
              <Select value={refCol} onValueChange={setRefCol}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setDateCol('');
                setDescCol('');
                setAmountMode('single');
                setAmountCol('');
                setDebitCol('');
                setCreditCol('');
                setRefCol('__none__');
                setDateFormat('YYYY-MM-DD');
                setStep('paste');
              }}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={
                  isLoading ||
                  !dateCol ||
                  !descCol ||
                  (amountMode === 'single' ? !amountCol : !debitCol || !creditCol)
                }
              >
                {isLoading ? 'Importing...' : 'Import'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
