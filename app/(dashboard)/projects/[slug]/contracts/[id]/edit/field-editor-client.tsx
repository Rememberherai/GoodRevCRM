'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, Trash2, Loader2,
  PenTool, Type, Hash, Calendar, CheckSquare, ChevronDown, Mail, Building, User,
} from 'lucide-react';
import { FIELD_TYPE_LABELS, type ContractFieldType } from '@/types/contract';
import { MERGE_FIELD_OPTIONS } from '@/lib/contracts/merge-field-keys';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Field {
  id?: string;
  tempId: string;
  recipient_id: string;
  field_type: ContractFieldType;
  label: string | null;
  placeholder: string | null;
  is_required: boolean;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  options: string[] | null;
  auto_populate_from: string | null;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface DragState {
  tempId: string;
  offsetXPercent: number;
  offsetYPercent: number;
}

const FIELD_TYPE_ICONS: Partial<Record<ContractFieldType, typeof PenTool>> = {
  signature: PenTool,
  initials: Type,
  date_signed: Calendar,
  text_input: Hash,
  checkbox: CheckSquare,
  dropdown: ChevronDown,
  name: User,
  email: Mail,
  company: Building,
  title: Type,
};

const SIGNER_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

export function FieldEditorClient() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const id = params.id as string;

  const [fields, setFields] = useState<Field[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [dragging, setDragging] = useState<DragState | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const recipientColorMap = new Map<string, string>();
  recipients.forEach((r, i) => {
    recipientColorMap.set(r.id, SIGNER_COLORS[i % SIGNER_COLORS.length]!);
  });

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/contracts/${id}`);
      if (!res.ok) throw new Error('Failed to load contract');
      const data = await res.json();

      setDocumentTitle(data.contract.title);
      setPageCount(data.contract.page_count);
      setRecipients(data.contract.recipients);

      if (!data.contract.recipients || data.contract.recipients.length === 0) {
        router.replace(`/projects/${slug}/contracts/${id}?setup=recipients`);
        return;
      }

      // Map existing fields
      const existingFields: Field[] = (data.contract.fields ?? []).map((f: Record<string, unknown>) => ({
        id: f.id,
        tempId: f.id ?? crypto.randomUUID(),
        recipient_id: f.recipient_id as string,
        field_type: f.field_type as ContractFieldType,
        label: f.label as string | null,
        placeholder: f.placeholder as string | null,
        is_required: f.is_required as boolean,
        page_number: f.page_number as number,
        x: Number(f.x),
        y: Number(f.y),
        width: Number(f.width),
        height: Number(f.height),
        options: f.options as string[] | null,
        auto_populate_from: (f.auto_populate_from as string) ?? null,
      }));
      setFields(existingFields);

      // Load PDF for preview
      const pdfRes = await fetch(`/api/projects/${slug}/contracts/${id}/download?version=original`);
      if (pdfRes.ok) {
        const blob = await pdfRes.blob();
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        const url = URL.createObjectURL(blob);
        pdfUrlRef.current = url;
        setPdfUrl(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [slug, id, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedField) return;

      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable = tagName === 'input' || tagName === 'textarea' || target?.getAttribute('role') === 'combobox';
      if (isEditable) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeField(selectedField);
      } else if (e.key === 'Escape') {
        setSelectedField(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedField]);

  const clampFieldBounds = useCallback((field: Field, updates: Partial<Field>): Partial<Field> => {
    const nextWidth = Math.max(1, Math.min(100, updates.width ?? field.width));
    const nextHeight = Math.max(1, Math.min(100, updates.height ?? field.height));
    const nextX = updates.x ?? field.x;
    const nextY = updates.y ?? field.y;

    return {
      ...updates,
      width: nextWidth,
      height: nextHeight,
      x: Math.max(0, Math.min(100 - nextWidth, nextX)),
      y: Math.max(0, Math.min(100 - nextHeight, nextY)),
    };
  }, []);

  const addField = (type: ContractFieldType) => {
    if (recipients.length === 0) {
      setError('Add recipients before placing fields');
      return;
    }

    const defaultSizes: Partial<Record<ContractFieldType, { w: number; h: number }>> = {
      signature: { w: 20, h: 5 },
      initials: { w: 8, h: 5 },
      date_signed: { w: 15, h: 3 },
      text_input: { w: 20, h: 3 },
      checkbox: { w: 3, h: 3 },
      dropdown: { w: 18, h: 3 },
      name: { w: 20, h: 3 },
      email: { w: 25, h: 3 },
      company: { w: 20, h: 3 },
      title: { w: 15, h: 3 },
    };

    const size = defaultSizes[type] ?? { w: 20, h: 3 };
    // Place new fields in the center of the page, stacking down for subsequent ones
    const existingOnPage = fields.filter((f) => f.page_number === currentPage).length;
    const centerX = Math.max(5, (100 - size.w) / 2);
    const startY = 40; // Start near vertical center
    const offsetY = existingOnPage * 8;
    const y = (startY + offsetY) % 85; // Wrap around to avoid going off-page

    const newField: Field = {
      tempId: crypto.randomUUID(),
      recipient_id: recipients[0]!.id,
      field_type: type,
      label: FIELD_TYPE_LABELS[type],
      placeholder: null,
      is_required: true,
      page_number: currentPage,
      x: centerX,
      y,
      width: size.w,
      height: size.h,
      options: type === 'dropdown' ? [''] : null,
      auto_populate_from: null,
    };

    setFields((prev) => [...prev, newField]);
    setSelectedField(newField.tempId);
  };

  const updateField = (tempId: string, updates: Partial<Field>) => {
    setFields((prev) =>
      prev.map((f) => (f.tempId === tempId ? { ...f, ...clampFieldBounds(f, updates) } : f))
    );
  };

  const removeField = (tempId: string) => {
    setFields((prev) => prev.filter((f) => f.tempId !== tempId));
    if (selectedField === tempId) setSelectedField(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/contracts/${id}/fields`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: fields.map((f) => ({
            recipient_id: f.recipient_id,
            field_type: f.field_type,
            label: f.label,
            placeholder: f.placeholder,
            is_required: f.is_required,
            page_number: f.page_number,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            options: f.options,
            auto_populate_from: f.auto_populate_from,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Save failed');
      }

      router.push(`/projects/${slug}/contracts/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleFieldMouseDown = (e: React.MouseEvent, field: Field) => {
    if (!pdfContainerRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = pdfContainerRef.current.getBoundingClientRect();
    const pointerX = ((e.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((e.clientY - rect.top) / rect.height) * 100;

    setSelectedField(field.tempId);
    setDragging({
      tempId: field.tempId,
      offsetXPercent: pointerX - field.x,
      offsetYPercent: pointerY - field.y,
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !pdfContainerRef.current) return;

    const rect = pdfContainerRef.current.getBoundingClientRect();
    const field = fields.find((f) => f.tempId === dragging.tempId);
    if (!field) return;

    const pointerX = ((e.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((e.clientY - rect.top) / rect.height) * 100;
    const nextX = pointerX - dragging.offsetXPercent;
    const nextY = pointerY - dragging.offsetYPercent;

    updateField(dragging.tempId, {
      x: Math.max(0, Math.min(100 - field.width, nextX)),
      y: Math.max(0, Math.min(100 - field.height, nextY)),
    });
  }, [dragging, fields]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  const currentPageFields = fields.filter((f) => f.page_number === currentPage);
  const selected = fields.find((f) => f.tempId === selectedField);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${slug}/contracts/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">Edit Fields</h1>
            <p className="text-sm text-muted-foreground">{documentTitle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/projects/${slug}/contracts/${id}`}>Cancel</Link>
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save & Return
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4" style={{ height: 'calc(100vh - 180px)' }}>
        {/* Field Palette */}
        <div className="col-span-2 space-y-3 overflow-y-auto">
          <Card>
            <CardHeader className="py-3 px-3">
              <CardTitle className="text-sm">Add Field</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1">
              {(Object.entries(FIELD_TYPE_LABELS) as [ContractFieldType, string][])
                .filter(([type]) => type !== 'initials')
                .map(([type, label]) => {
                const Icon = FIELD_TYPE_ICONS[type] ?? Hash;
                return (
                  <button
                    key={type}
                    onClick={() => addField(type)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors text-left"
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    {label}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Recipients legend */}
          <Card>
            <CardHeader className="py-3 px-3">
              <CardTitle className="text-sm">Recipients</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1">
              {recipients.map((r, i) => (
                <div key={r.id} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: SIGNER_COLORS[i % SIGNER_COLORS.length] }}
                  />
                  <span className="truncate">{r.name}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* PDF Viewer with field overlays */}
        <div className="col-span-7 bg-gray-100 rounded-lg overflow-hidden flex flex-col">
          {/* Page nav */}
          <div className="bg-white border-b px-3 py-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {pageCount}
            </span>
            <span className="text-xs text-muted-foreground">
              {currentPageFields.length} field{currentPageFields.length === 1 ? '' : 's'} on this page
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                Prev
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage >= pageCount}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>

          {/* PDF + overlays */}
          <div
            ref={pdfContainerRef}
            className="flex-1 relative overflow-auto"
            onMouseDown={() => setSelectedField(null)}
            onMouseLeave={handleMouseUp}
          >
            {pdfUrl ? (
              <iframe
                src={`${pdfUrl}#page=${currentPage}`}
                className="w-full h-full border-0 pointer-events-none select-none"
                title="PDF Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No PDF preview available</p>
              </div>
            )}

            {/* Field overlays */}
            {currentPageFields.map((field) => {
              const color = recipientColorMap.get(field.recipient_id) ?? '#6b7280';
              const isSelected = selectedField === field.tempId;
              const Icon = FIELD_TYPE_ICONS[field.field_type] ?? Hash;

              return (
                <div
                  key={field.tempId}
                  className="absolute cursor-move flex items-center gap-1 text-white text-xs font-medium rounded px-1"
                  style={{
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    width: `${field.width}%`,
                    height: `${field.height}%`,
                    backgroundColor: `${color}${isSelected ? 'cc' : '66'}`,
                    border: isSelected ? `2px solid ${color}` : `1px solid ${color}88`,
                    zIndex: isSelected ? 10 : 1,
                  }}
                  onMouseDown={(e) => handleFieldMouseDown(e, field)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedField(field.tempId);
                  }}
                >
                  <Icon className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{field.label ?? field.field_type}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Properties Panel */}
        <div className="col-span-3 overflow-y-auto">
          {selected ? (
            <Card>
              <CardHeader className="py-3 px-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Field Properties</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeField(selected.tempId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-3">
                <div>
                  <Label className="text-xs">Type</Label>
                  <p className="text-sm font-medium">{FIELD_TYPE_LABELS[selected.field_type]}</p>
                </div>

                <div>
                  <Label className="text-xs">Assigned To</Label>
                  <Select
                    value={selected.recipient_id}
                    onValueChange={(v) => updateField(selected.tempId, { recipient_id: v })}
                  >
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {recipients.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={selected.label ?? ''}
                    onChange={(e) => updateField(selected.tempId, { label: e.target.value || null })}
                    className="mt-1 h-8 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs">Placeholder</Label>
                  <Input
                    value={selected.placeholder ?? ''}
                    onChange={(e) => updateField(selected.tempId, { placeholder: e.target.value || null })}
                    className="mt-1 h-8 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.is_required}
                    onChange={(e) => updateField(selected.tempId, { is_required: e.target.checked })}
                    className="rounded"
                  />
                  <Label className="text-xs">Required</Label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">X (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={selected.x}
                      onChange={(e) => updateField(selected.tempId, { x: Number(e.target.value) })}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Y (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={selected.y}
                      onChange={(e) => updateField(selected.tempId, { y: Number(e.target.value) })}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width (%)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      step={0.5}
                      value={selected.width}
                      onChange={(e) => updateField(selected.tempId, { width: Number(e.target.value) })}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height (%)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      step={0.5}
                      value={selected.height}
                      onChange={(e) => updateField(selected.tempId, { height: Number(e.target.value) })}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Page</Label>
                  <Input
                    type="number"
                    min={1}
                    max={pageCount}
                    value={selected.page_number}
                    onChange={(e) => {
                      const page = Number(e.target.value);
                      updateField(selected.tempId, { page_number: page });
                      setCurrentPage(page);
                    }}
                    className="mt-1 h-8 text-xs"
                  />
                </div>

                {!['signature', 'initials', 'checkbox', 'dropdown'].includes(selected.field_type) && (
                  <div>
                    <Label className="text-xs">Auto-fill from CRM</Label>
                    <Select
                      value={selected.auto_populate_from ?? '_none'}
                      onValueChange={(v) => updateField(selected.tempId, {
                        auto_populate_from: v === '_none' ? null : v,
                      })}
                    >
                      <SelectTrigger className="mt-1 h-8 text-xs">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">None</SelectItem>
                        {MERGE_FIELD_OPTIONS.map((opt) => (
                          <SelectItem key={opt.key} value={opt.key}>{opt.group}: {opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-1">Value is resolved and frozen when the document is sent.</p>
                  </div>
                )}

                {selected.field_type === 'dropdown' && (
                  <div>
                    <Label className="text-xs">Dropdown Options</Label>
                    <div className="mt-1 space-y-1.5">
                      {(selected.options as string[] ?? []).map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <Input
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...(selected.options as string[] ?? [])];
                              newOpts[idx] = e.target.value;
                              updateField(selected.tempId, { options: newOpts });
                            }}
                            placeholder={`Option ${idx + 1}`}
                            className="h-7 text-xs flex-1"
                          />
                          <button
                            onClick={() => {
                              const newOpts = (selected.options as string[] ?? []).filter((_, i) => i !== idx);
                              updateField(selected.tempId, { options: newOpts.length ? newOpts : [''] });
                            }}
                            className="text-muted-foreground hover:text-destructive p-0.5"
                            title="Remove option"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const newOpts = [...(selected.options as string[] ?? []), ''];
                          updateField(selected.tempId, { options: newOpts });
                        }}
                        className="text-xs text-primary hover:underline mt-1"
                      >
                        + Add option
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                <p>Select a field to edit its properties</p>
                <p className="mt-2 text-xs">Click a field to edit it, or drag fields around on the page after placing them.</p>
              </CardContent>
            </Card>
          )}

          {/* Field list */}
          <Card className="mt-3">
            <CardHeader className="py-3 px-3">
              <CardTitle className="text-sm">All Fields ({fields.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1">
              {fields.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4 space-y-1">
                  <p>No fields placed yet</p>
                  <p>Choose a field type from the left to place your first signer field.</p>
                </div>
              ) : (
                fields.map((f) => {
                  const color = recipientColorMap.get(f.recipient_id) ?? '#6b7280';
                  return (
                    <button
                      key={f.tempId}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors text-left ${
                        selectedField === f.tempId ? 'bg-muted' : ''
                      }`}
                      onClick={() => {
                        setSelectedField(f.tempId);
                        setCurrentPage(f.page_number);
                      }}
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="flex-1 truncate">{f.label ?? f.field_type}</span>
                      <span className="text-muted-foreground">p{f.page_number}</span>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
