'use client';

import { useEmailBuilderStore } from '@/stores/email-builder';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ColorPicker } from './color-picker';
import { WEB_SAFE_FONTS } from '@/types/email-builder';

function fontLabel(font: string): string {
  return (font.split(',')[0] ?? font).replace(/"/g, '').trim();
}

export function GlobalStylesPanel() {
  const globalStyles = useEmailBuilderStore((s) => s.design.globalStyles);
  const updateGlobalStyles = useEmailBuilderStore((s) => s.updateGlobalStyles);

  return (
    <div className="space-y-4 p-4 overflow-auto">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
        Email Styles
      </h3>

      <ColorPicker
        value={globalStyles.backgroundColor}
        onChange={(c) => updateGlobalStyles({ backgroundColor: c })}
        label="Background Color"
      />

      <div>
        <Label className="text-xs">
          Content Width: {globalStyles.contentWidth}px
        </Label>
        <Slider
          min={320}
          max={800}
          step={10}
          value={[globalStyles.contentWidth]}
          onValueChange={(vals) => updateGlobalStyles({ contentWidth: vals[0] })}
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-xs">Default Font</Label>
        <Select
          value={globalStyles.fontFamily}
          onValueChange={(v) => updateGlobalStyles({ fontFamily: v })}
        >
          <SelectTrigger className="h-8 text-xs mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEB_SAFE_FONTS.map((f) => (
              <SelectItem key={f} value={f}>
                {fontLabel(f)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">
          Default Font Size: {globalStyles.fontSize}px
        </Label>
        <Slider
          min={10}
          max={32}
          step={1}
          value={[globalStyles.fontSize]}
          onValueChange={(vals) => updateGlobalStyles({ fontSize: vals[0] })}
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-xs">
          Line Height: {globalStyles.lineHeight}
        </Label>
        <Slider
          min={1}
          max={3}
          step={0.1}
          value={[globalStyles.lineHeight]}
          onValueChange={(vals) => updateGlobalStyles({ lineHeight: Math.round((vals[0] ?? 1.5) * 10) / 10 })}
          className="mt-1"
        />
      </div>

      <ColorPicker
        value={globalStyles.textColor}
        onChange={(c) => updateGlobalStyles({ textColor: c })}
        label="Default Text Color"
      />

      <ColorPicker
        value={globalStyles.linkColor}
        onChange={(c) => updateGlobalStyles({ linkColor: c })}
        label="Link Color"
      />
    </div>
  );
}
