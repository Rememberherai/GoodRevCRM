'use client';

import * as React from 'react';
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfQuarter, startOfYear } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { DateRange as RDPDateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { DateRange } from '@/types/analytics';

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

interface Preset {
  label: string;
  getValue: () => DateRange;
}

function getPresets(): Preset[] {
  const today = new Date();
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

  return [
    {
      label: '7d',
      getValue: () => ({
        from: subDays(endOfToday, 6),
        to: endOfToday,
      }),
    },
    {
      label: '30d',
      getValue: () => ({
        from: subDays(endOfToday, 29),
        to: endOfToday,
      }),
    },
    {
      label: 'This Month',
      getValue: () => ({
        from: startOfMonth(today),
        to: endOfToday,
      }),
    },
    {
      label: 'Last Month',
      getValue: () => {
        const lastMonth = subMonths(today, 1);
        return {
          from: startOfMonth(lastMonth),
          to: endOfMonth(lastMonth),
        };
      },
    },
    {
      label: 'This Quarter',
      getValue: () => ({
        from: startOfQuarter(today),
        to: endOfToday,
      }),
    },
    {
      label: 'YTD',
      getValue: () => ({
        from: startOfYear(today),
        to: endOfToday,
      }),
    },
  ];
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const presets = React.useMemo(() => getPresets(), []);

  const calendarValue: RDPDateRange | undefined = value
    ? { from: value.from, to: value.to }
    : undefined;

  function handlePresetClick(preset: Preset) {
    onChange(preset.getValue());
    setOpen(false);
  }

  function handleCalendarSelect(range: RDPDateRange | undefined) {
    if (range?.from && range?.to) {
      onChange({ from: range.from, to: range.to });
      setOpen(false);
    } else if (range?.from) {
      // User selected only the start date so far; keep the popover open
      // and pass a partial selection to the calendar so it renders correctly.
      // We don't call onChange yet because `to` is required.
    } else {
      onChange(undefined);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[280px] justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? (
            <>
              {format(value.from, 'MMM d, yyyy')} &ndash; {format(value.to, 'MMM d, yyyy')}
            </>
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Preset sidebar */}
          <div className="flex flex-col gap-1 border-r p-3">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start text-xs"
                onClick={() => handlePresetClick(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={calendarValue}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              defaultMonth={value?.from ? subMonths(value.from, 0) : subMonths(new Date(), 1)}
              disabled={{ after: new Date() }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
