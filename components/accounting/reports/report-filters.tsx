'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download } from 'lucide-react';

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onApply: () => void;
  loading?: boolean;
  onExportCSV?: () => void;
}

export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApply,
  loading,
  onExportCSV,
}: DateRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Start Date</Label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">End Date</Label>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-40"
        />
      </div>
      <Button onClick={onApply} disabled={loading} size="sm">
        {loading ? 'Loading...' : 'Apply'}
      </Button>
      {onExportCSV && (
        <Button variant="outline" size="sm" onClick={onExportCSV}>
          <Download className="h-4 w-4 mr-1" />
          CSV
        </Button>
      )}
    </div>
  );
}

interface AsOfDateFilterProps {
  asOfDate: string;
  onDateChange: (date: string) => void;
  onApply: () => void;
  loading?: boolean;
  onExportCSV?: () => void;
}

export function AsOfDateFilter({
  asOfDate,
  onDateChange,
  onApply,
  loading,
  onExportCSV,
}: AsOfDateFilterProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">As of Date</Label>
        <Input
          type="date"
          value={asOfDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-40"
        />
      </div>
      <Button onClick={onApply} disabled={loading} size="sm">
        {loading ? 'Loading...' : 'Apply'}
      </Button>
      {onExportCSV && (
        <Button variant="outline" size="sm" onClick={onExportCSV}>
          <Download className="h-4 w-4 mr-1" />
          CSV
        </Button>
      )}
    </div>
  );
}

/** Quick-select date range presets */
export function useDatePresets() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  return {
    thisMonth: {
      start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      end: localDateString(today),
    },
    lastMonth: {
      start: localDateString(new Date(year, month - 1, 1)),
      end: localDateString(new Date(year, month, 0)),
    },
    thisQuarter: {
      start: localDateString(new Date(year, Math.floor(month / 3) * 3, 1)),
      end: localDateString(today),
    },
    thisYear: {
      start: `${year}-01-01`,
      end: localDateString(today),
    },
    lastYear: {
      start: `${year - 1}-01-01`,
      end: `${year - 1}-12-31`,
    },
  };
}

export function getTodayDateInputValue(): string {
  return localDateString(new Date());
}

interface PresetButtonsProps {
  onSelect: (start: string, end: string) => void;
}

export function PresetButtons({ onSelect }: PresetButtonsProps) {
  const presets = useDatePresets();

  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(presets).map(([key, { start, end }]) => (
        <Button
          key={key}
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onSelect(start, end)}
        >
          {key === 'thisMonth'
            ? 'This Month'
            : key === 'lastMonth'
              ? 'Last Month'
              : key === 'thisQuarter'
                ? 'This Quarter'
                : key === 'thisYear'
                  ? 'This Year'
                  : 'Last Year'}
        </Button>
      ))}
    </div>
  );
}

/** Download data as CSV */
export function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      r.map((c) => (c.includes(',') || c.includes('"') ? `"${c.replace(/"/g, '""')}"` : c)).join(','),
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
