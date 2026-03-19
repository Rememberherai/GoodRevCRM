import type { z } from 'zod';
import type { csvColumnMappingSchema } from '@/lib/validators/bank';

type ColumnMapping = z.infer<typeof csvColumnMappingSchema>;

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  reference: string | null;
}

function parseCSVLine(line: string): string[] {
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
  return result;
}

function parseDate(value: string, format: string): string | null {
  const cleaned = value.trim();
  if (!cleaned) return null;

  if (format === 'YYYY-MM-DD' || format === 'yyyy-mm-dd') {
    const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return cleaned;
  }

  if (format === 'MM/DD/YYYY' || format === 'mm/dd/yyyy') {
    const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      return `${match[3]}-${match[1]!.padStart(2, '0')}-${match[2]!.padStart(2, '0')}`;
    }
  }

  if (format === 'DD/MM/YYYY' || format === 'dd/mm/yyyy') {
    const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      return `${match[3]}-${match[2]!.padStart(2, '0')}-${match[1]!.padStart(2, '0')}`;
    }
  }

  return null;
}

function parseAmount(value: string): number | null {
  const cleaned = value.trim().replace(/[$,\s]/g, '');
  if (!cleaned) return null;

  // Handle parentheses for negative: (100.00) → -100.00
  const parenMatch = cleaned.match(/^\((.+)\)$/);
  if (parenMatch) {
    const num = parseFloat(parenMatch[1]!);
    return isNaN(num) ? null : -num;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function parseCSVTransactions(
  csvData: string,
  mapping: ColumnMapping
): ParsedTransaction[] {
  const lines = csvData.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]!);
  const dateIdx = headers.indexOf(mapping.date_column);
  const descIdx = headers.indexOf(mapping.description_column);
  const amountIdx = mapping.amount_column ? headers.indexOf(mapping.amount_column) : -1;
  const debitIdx = mapping.debit_column ? headers.indexOf(mapping.debit_column) : -1;
  const creditIdx = mapping.credit_column ? headers.indexOf(mapping.credit_column) : -1;
  const refIdx = mapping.reference_column ? headers.indexOf(mapping.reference_column) : -1;

  if (dateIdx === -1 || descIdx === -1) return [];
  if (amountIdx === -1 && (debitIdx === -1 || creditIdx === -1)) return [];

  const results: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]!);
    const date = parseDate(cols[dateIdx] ?? '', mapping.date_format);
    if (!date) continue;

    const description = (cols[descIdx] ?? '').trim();
    if (!description) continue;

    let amount: number | null;
    if (amountIdx !== -1) {
      amount = parseAmount(cols[amountIdx] ?? '');
    } else {
      const debit = parseAmount(cols[debitIdx] ?? '') ?? 0;
      const credit = parseAmount(cols[creditIdx] ?? '') ?? 0;
      amount = credit - debit;
    }

    if (amount === null) continue;

    results.push({
      date,
      description,
      amount,
      reference: refIdx !== -1 ? (cols[refIdx] ?? '').trim() || null : null,
    });
  }

  return results;
}
