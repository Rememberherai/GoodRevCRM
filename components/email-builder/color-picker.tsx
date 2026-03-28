'use client';

import { Input } from '@/components/ui/input';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

const PRESETS = [
  '#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff',
  '#1a73e8', '#0d47a1', '#e53935', '#d81b60', '#43a047', '#f57c00',
];

function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value);
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const pickerValue = isHexColor(value) ? value : PRESETS[0];

  return (
    <div className="space-y-1.5">
      {label && <div className="text-xs font-medium text-muted-foreground">{label}</div>}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded border border-border p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-24 font-mono text-xs"
          placeholder="#000000"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className="h-5 w-5 rounded border border-border transition-transform hover:scale-110"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}
