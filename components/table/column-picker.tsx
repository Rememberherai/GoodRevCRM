'use client';

import { Settings2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ResolvedColumn } from '@/types/table-columns';

interface ColumnPickerProps {
  columns: ResolvedColumn[];
  onToggle: (key: string) => void;
  onReset: () => void;
  isSaving?: boolean;
}

export function ColumnPicker({
  columns,
  onToggle,
  onReset,
  isSaving,
}: ColumnPickerProps) {
  // Separate system and custom columns
  const systemColumns = columns.filter(c => c.type === 'system');
  const customColumns = columns.filter(c => c.type === 'custom');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Settings2 className="mr-2 h-4 w-4" />
          Columns
          {isSaving && (
            <span className="ml-2 h-2 w-2 rounded-full bg-primary animate-pulse" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-[400px] overflow-y-auto">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* System columns */}
        {systemColumns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.key}
            checked={column.visible}
            onCheckedChange={() => onToggle(column.key)}
            onSelect={(e) => e.preventDefault()}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}

        {/* Custom fields section */}
        {customColumns.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Custom Fields
            </DropdownMenuLabel>
            {customColumns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.key}
                checked={column.visible}
                onCheckedChange={() => onToggle(column.key)}
                onSelect={(e) => e.preventDefault()}
              >
                {column.label}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        <div className="p-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={onReset}
          >
            <RotateCcw className="mr-2 h-3 w-3" />
            Reset to default
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
