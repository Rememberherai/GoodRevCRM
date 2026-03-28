'use client';

import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useEmailBuilderStore } from '@/stores/email-builder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ColorPicker } from './color-picker';
import { WEB_SAFE_FONTS } from '@/types/email-builder';
import type { EmailBlock, Alignment, DividerStyle } from '@/types/email-builder';

function fontLabel(font: string): string {
  return (font.split(',')[0] ?? font).replace(/"/g, '').trim();
}

interface PropertyPanelProps {
  slug?: string;
}

export function PropertyPanel({ slug }: PropertyPanelProps) {
  const selectedBlockId = useEmailBuilderStore((s) => s.selectedBlockId);
  const block = useEmailBuilderStore((s) =>
    s.selectedBlockId ? s.design.blocks.find((b) => b.id === s.selectedBlockId) : undefined
  );
  const updateBlock = useEmailBuilderStore((s) => s.updateBlock);
  const updateBlockDebounced = useEmailBuilderStore((s) => s.updateBlockDebounced);

  if (!block || !selectedBlockId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a block to edit its properties.
      </div>
    );
  }

  const update = (patch: Partial<EmailBlock>) => updateBlock(selectedBlockId, patch);
  const updateDebounced = (patch: Partial<EmailBlock>) => updateBlockDebounced(selectedBlockId, patch);

  return (
    <div className="space-y-4 p-4 overflow-auto">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
        {block.type} Properties
      </h3>

      {/* Common: background color */}
      <div>
        <ColorPicker
          value={block.backgroundColor || ''}
          onChange={(c) => update({ backgroundColor: c || undefined })}
          label="Background"
        />
      </div>

      {/* Common: padding */}
      <PaddingFields block={block} onUpdate={update} />

      {/* Type-specific fields */}
      {block.type === 'text' && <TextFields block={block} onUpdate={update} />}
      {block.type === 'image' && <ImageFields block={block} onUpdate={update} onUpdateDebounced={updateDebounced} slug={slug} />}
      {block.type === 'button' && <ButtonFields block={block} onUpdate={update} onUpdateDebounced={updateDebounced} />}
      {block.type === 'divider' && <DividerFields block={block} onUpdate={update} />}
      {block.type === 'spacer' && <SpacerFields block={block} onUpdate={update} />}
    </div>
  );
}

// ── Padding ──────────────────────────────────────────────────────────────

function PaddingFields({
  block,
  onUpdate,
}: {
  block: EmailBlock;
  onUpdate: (p: Partial<EmailBlock>) => void;
}) {
  const p = block.padding || { top: 0, right: 0, bottom: 0, left: 0 };
  const setPad = (key: 'top' | 'right' | 'bottom' | 'left', val: number) =>
    onUpdate({ padding: { ...p, [key]: val } });

  return (
    <div>
      <Label className="text-xs">Padding</Label>
      <div className="grid grid-cols-2 gap-2 mt-1">
        {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
          <div key={side} className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground w-6 capitalize">{side.charAt(0).toUpperCase()}</span>
            <Input
              type="number"
              min={0}
              max={100}
              value={p[side]}
              onChange={(e) => setPad(side, Number(e.target.value))}
              className="h-7 text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Text ─────────────────────────────────────────────────────────────────

function TextFields({
  block,
  onUpdate,
}: {
  block: Extract<EmailBlock, { type: 'text' }>;
  onUpdate: (p: Partial<EmailBlock>) => void;
}) {
  return (
    <>
      <div>
        <Label className="text-xs">Font Family</Label>
        <Select
          value={block.fontFamily || '__default__'}
          onValueChange={(v) => onUpdate({ fontFamily: v === '__default__' ? undefined : v })}
        >
          <SelectTrigger className="h-8 text-xs mt-1">
            <SelectValue placeholder="Default" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">Default</SelectItem>
            {WEB_SAFE_FONTS.map((f) => (
              <SelectItem key={f} value={f}>
                {fontLabel(f)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Font Size: {block.fontSize || 'default'}px</Label>
        <Slider
          min={8}
          max={72}
          step={1}
          value={[block.fontSize || 16]}
          onValueChange={(vals) => onUpdate({ fontSize: vals[0] })}
          className="mt-1"
        />
      </div>
      <ColorPicker
        value={block.textColor || ''}
        onChange={(c) => onUpdate({ textColor: c || undefined })}
        label="Text Color"
      />
    </>
  );
}

// ── Image ────────────────────────────────────────────────────────────────

function ImageFields({
  block,
  onUpdate,
  onUpdateDebounced,
  slug,
}: {
  block: Extract<EmailBlock, { type: 'image' }>;
  onUpdate: (p: Partial<EmailBlock>) => void;
  onUpdateDebounced: (p: Partial<EmailBlock>) => void;
  slug?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !slug) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/projects/${slug}/email-images`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const { url } = await response.json();
      onUpdate({ src: url });
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <>
      {/* Upload button */}
      {slug && (
        <div>
          <Label className="text-xs">Upload Image</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full mt-1 h-8 text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1.5" />
            )}
            {uploading ? 'Uploading...' : 'Choose File'}
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1">Max 5 MB. JPEG, PNG, WebP, or GIF.</p>
        </div>
      )}

      <div>
        <Label className="text-xs">Image URL</Label>
        <Input
          value={block.src}
          onChange={(e) => onUpdateDebounced({ src: e.target.value })}
          className="h-8 text-xs mt-1"
          placeholder="https://..."
        />
      </div>
      <div>
        <Label className="text-xs">Alt Text</Label>
        <Input
          value={block.alt}
          onChange={(e) => onUpdateDebounced({ alt: e.target.value })}
          className="h-8 text-xs mt-1"
          placeholder="Image description"
        />
      </div>
      <div>
        <Label className="text-xs">Width: {block.width}px</Label>
        <Slider
          min={10}
          max={1200}
          step={10}
          value={[block.width]}
          onValueChange={(vals) => onUpdate({ width: vals[0] })}
          className="mt-1"
        />
      </div>
      <AlignField value={block.align} onChange={(v) => onUpdate({ align: v })} />
      <div>
        <Label className="text-xs">Link URL (optional)</Label>
        <Input
          value={block.linkUrl || ''}
          onChange={(e) => onUpdateDebounced({ linkUrl: e.target.value || undefined })}
          className="h-8 text-xs mt-1"
          placeholder="https://..."
        />
      </div>
    </>
  );
}

// ── Button ───────────────────────────────────────────────────────────────

function ButtonFields({
  block,
  onUpdate,
  onUpdateDebounced,
}: {
  block: Extract<EmailBlock, { type: 'button' }>;
  onUpdate: (p: Partial<EmailBlock>) => void;
  onUpdateDebounced: (p: Partial<EmailBlock>) => void;
}) {
  return (
    <>
      <div>
        <Label className="text-xs">Button Text</Label>
        <Input
          value={block.text}
          onChange={(e) => onUpdateDebounced({ text: e.target.value })}
          className="h-8 text-xs mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">URL</Label>
        <Input
          value={block.url}
          onChange={(e) => onUpdateDebounced({ url: e.target.value })}
          className="h-8 text-xs mt-1"
          placeholder="https://..."
        />
      </div>
      <ColorPicker
        value={block.buttonColor}
        onChange={(c) => onUpdate({ buttonColor: c })}
        label="Button Color"
      />
      <ColorPicker
        value={block.textColor}
        onChange={(c) => onUpdate({ textColor: c })}
        label="Text Color"
      />
      <div>
        <Label className="text-xs">Border Radius: {block.borderRadius}px</Label>
        <Slider
          min={0}
          max={50}
          step={1}
          value={[block.borderRadius]}
          onValueChange={(vals) => onUpdate({ borderRadius: vals[0] })}
          className="mt-1"
        />
      </div>
      <AlignField value={block.align} onChange={(v) => onUpdate({ align: v })} />
      <div className="flex items-center gap-2">
        <Switch
          checked={block.fullWidth}
          onCheckedChange={(v) => onUpdate({ fullWidth: v })}
          id="btn-fullwidth"
        />
        <Label htmlFor="btn-fullwidth" className="text-xs">
          Full Width
        </Label>
      </div>
    </>
  );
}

// ── Divider ──────────────────────────────────────────────────────────────

function DividerFields({
  block,
  onUpdate,
}: {
  block: Extract<EmailBlock, { type: 'divider' }>;
  onUpdate: (p: Partial<EmailBlock>) => void;
}) {
  return (
    <>
      <ColorPicker
        value={block.color}
        onChange={(c) => onUpdate({ color: c })}
        label="Color"
      />
      <div>
        <Label className="text-xs">Thickness: {block.thickness}px</Label>
        <Slider
          min={1}
          max={10}
          step={1}
          value={[block.thickness]}
          onValueChange={(vals) => onUpdate({ thickness: vals[0] })}
          className="mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Style</Label>
        <Select
          value={block.style}
          onValueChange={(v) => onUpdate({ style: v as DividerStyle })}
        >
          <SelectTrigger className="h-8 text-xs mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="dashed">Dashed</SelectItem>
            <SelectItem value="dotted">Dotted</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

// ── Spacer ───────────────────────────────────────────────────────────────

function SpacerFields({
  block,
  onUpdate,
}: {
  block: Extract<EmailBlock, { type: 'spacer' }>;
  onUpdate: (p: Partial<EmailBlock>) => void;
}) {
  return (
    <div>
      <Label className="text-xs">Height: {block.height}px</Label>
      <Slider
        min={4}
        max={200}
        step={4}
        value={[block.height]}
        onValueChange={(vals) => onUpdate({ height: vals[0] })}
        className="mt-1"
      />
    </div>
  );
}

// ── Alignment helper ─────────────────────────────────────────────────────

function AlignField({
  value,
  onChange,
}: {
  value: Alignment;
  onChange: (v: Alignment) => void;
}) {
  return (
    <div>
      <Label className="text-xs">Alignment</Label>
      <Select value={value} onValueChange={(v) => onChange(v as Alignment)}>
        <SelectTrigger className="h-8 text-xs mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Left</SelectItem>
          <SelectItem value="center">Center</SelectItem>
          <SelectItem value="right">Right</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
