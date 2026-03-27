'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ConfigEditor, type EditablePublicDashboardConfig } from '@/components/community/public-dashboard/config-editor';
import { ShareLinks } from '@/components/community/public-dashboard/share-links';
import { PublishControls } from '@/components/community/public-dashboard/publish-controls';
import { PublicDashboardView } from '@/components/community/public-dashboard/public-dashboard-view';
import { SAMPLE_DASHBOARD_DATA } from '@/lib/community/public-dashboard-sample-data';
import type { Database, Json } from '@/types/database';

type PublicDashboardConfig = Database['public']['Tables']['public_dashboard_configs']['Row'];

interface ConfigRecord extends EditablePublicDashboardConfig {
  id: string;
}

function toEditableConfig(config: Partial<ConfigRecord> = {}): EditablePublicDashboardConfig {
  return {
    id: config.id,
    title: config.title ?? 'Community Impact Dashboard',
    description: config.description ?? '',
    slug: config.slug ?? `impact-${Date.now()}`,
    status: config.status ?? 'draft',
    access_type: config.access_type ?? 'public',
    data_freshness: config.data_freshness ?? 'live',
    min_count_threshold: config.min_count_threshold ?? 5,
    geo_granularity: config.geo_granularity ?? 'zip',
    hero_image_url: config.hero_image_url ?? '',
    widgets: config.widgets ?? [],
  };
}

function normalizeDraft(draft: EditablePublicDashboardConfig | null): string {
  if (!draft) return '';
  const { password: _pw, ...rest } = draft;
  return JSON.stringify(rest);
}

function draftToPreviewConfig(draft: EditablePublicDashboardConfig): PublicDashboardConfig {
  return {
    id: draft.id ?? '',
    project_id: '',
    title: draft.title,
    description: draft.description,
    slug: draft.slug,
    status: draft.status,
    access_type: draft.access_type,
    data_freshness: draft.data_freshness,
    min_count_threshold: draft.min_count_threshold,
    geo_granularity: draft.geo_granularity,
    hero_image_url: draft.hero_image_url,
    widgets: draft.widgets as unknown as Json,
    // Deprecated: widget_order is no longer authored by the UI
    widget_order: [],
    theme: {} as Json,
    date_range_type: 'rolling',
    date_range_start: null,
    date_range_end: null,
    excluded_categories: [],
    password_hash: null,
    snapshot_data: null,
    published_at: null,
    published_by: null,
    archived_at: null,
    created_at: '',
    updated_at: '',
  };
}

export function PublicDashboardSettingsClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [configs, setConfigs] = useState<ConfigRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditablePublicDashboardConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const lastSavedRef = useRef<string>('');
  const abortRef = useRef<AbortController | null>(null);

  const isDirty = draft !== null && normalizeDraft(draft) !== lastSavedRef.current;

  // Warn on tab close / reload when dirty
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const loadConfigs = useCallback(async (selectId?: string | null, signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/projects/${slug}/public-dashboard`, { signal });
      if (signal?.aborted) return;
      if (!response.ok) {
        toast.error('Failed to load dashboard configurations');
        return;
      }
      const data = await response.json() as { configs?: ConfigRecord[] };
      const nextConfigs = (data.configs ?? []).map((config) => ({
        ...config,
        description: config.description ?? '',
        hero_image_url: config.hero_image_url ?? '',
        widgets: Array.isArray(config.widgets) ? config.widgets as ConfigRecord['widgets'] : [],
      }));
      setConfigs(nextConfigs);
      const matched = nextConfigs.find((config) => config.id === selectId) ?? nextConfigs[0] ?? null;
      if (matched) {
        setSelectedId(matched.id);
        const editable = toEditableConfig(matched);
        setDraft(editable);
        lastSavedRef.current = normalizeDraft(editable);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      toast.error('Failed to load dashboard configurations');
    }
  }, [slug]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void loadConfigs(selectedId, controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function confirmDiscardIfDirty(): boolean {
    if (!isDirty) return true;
    return window.confirm('You have unsaved changes. Discard them?');
  }

  function handleNewDashboard() {
    if (!confirmDiscardIfDirty()) return;
    const newDraft = toEditableConfig();
    setSelectedId(null);
    setDraft(newDraft);
    lastSavedRef.current = normalizeDraft(newDraft);
  }

  function handleSelectConfig(configId: string) {
    if (configId === selectedId) return;
    if (!confirmDiscardIfDirty()) return;
    const config = configs.find((c) => c.id === configId);
    if (!config) return;
    setSelectedId(config.id);
    const editable = toEditableConfig(config);
    setDraft(editable);
    lastSavedRef.current = normalizeDraft(editable);
  }

  function buildPayload(source: EditablePublicDashboardConfig) {
    const { id: _id, password, hero_image_url, ...rest } = source;
    return {
      ...rest,
      hero_image_url: hero_image_url || null,
      ...(password ? { password } : {}),
    };
  }

  async function saveConfig() {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const url = draft.id
        ? `/api/projects/${slug}/public-dashboard/${draft.id}`
        : `/api/projects/${slug}/public-dashboard`;
      const method = draft.id ? 'PATCH' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(draft)),
      });
      const data = await response.json() as { config?: ConfigRecord; error?: string; details?: { fieldErrors?: Record<string, string[]> } };
      if (response.ok && data.config) {
        setSelectedId(data.config.id);
        await loadConfigs(data.config.id);
        toast.success('Dashboard saved');
      } else {
        const fieldErrors = data.details?.fieldErrors;
        const detail = fieldErrors ? Object.entries(fieldErrors).map(([k, v]) => `${k}: ${v.join(', ')}`).join('; ') : '';
        toast.error(detail || data.error || 'Failed to save dashboard');
      }
    } catch {
      toast.error('Failed to save dashboard');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status: ConfigRecord['status']) {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const draftWithStatus = { ...draft, status };

      if (!draft.id) {
        const response = await fetch(`/api/projects/${slug}/public-dashboard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(draftWithStatus)),
        });
        const data = await response.json() as { config?: ConfigRecord; error?: string };
        if (!response.ok || !data.config) {
          toast.error(data.error ?? 'Failed to save dashboard');
          return;
        }
        await loadConfigs(data.config.id);
        toast.success(`Dashboard ${status}`);
        return;
      }

      const response = await fetch(`/api/projects/${slug}/public-dashboard/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(draftWithStatus)),
      });
      const data = await response.json() as { config?: ConfigRecord; error?: string };
      if (response.ok && data.config) {
        await loadConfigs(draft.id);
        toast.success(`Dashboard ${status}`);
      } else {
        toast.error(data.error ?? 'Failed to update status');
      }
    } catch {
      toast.error('Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  const previewPanel = draft ? (
    <div className="flex flex-col h-full">
      <div className="border-b bg-muted/30 px-4 py-2">
        <p className="text-xs text-muted-foreground">Preview — shows layout with sample data</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto">
          <PublicDashboardView config={draftToPreviewConfig(draft)} data={SAMPLE_DASHBOARD_DATA} />
        </div>
      </ScrollArea>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        {/* Config selector */}
        <div className="flex items-center gap-2">
          {configs.length > 0 ? (
            <Select value={selectedId ?? ''} onValueChange={handleSelectConfig}>
              <SelectTrigger className="w-[220px] h-8 text-sm">
                <SelectValue placeholder="Select dashboard" />
              </SelectTrigger>
              <SelectContent>
                {configs.map((config) => (
                  <SelectItem key={config.id} value={config.id}>
                    <span className="flex items-center gap-2">
                      {config.title}
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">{config.status}</Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground">No dashboards</span>
          )}
          <Button variant="outline" size="sm" onClick={handleNewDashboard}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New
          </Button>
        </div>

        <div className="flex-1" />

        {/* Status + Save */}
        <PublishControls status={draft?.status ?? 'draft'} disabled={saving} onStatusChange={(status) => void handleStatusChange(status)} />

        <div className="relative">
          <Button size="sm" onClick={() => void saveConfig()} disabled={saving || !draft}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          {isDirty && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500" />
          )}
        </div>

        {/* Preview toggle — desktop */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden lg:flex"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? <EyeOff className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
          {showPreview ? 'Hide Preview' : 'Preview'}
        </Button>

        {/* Preview toggle — mobile (Sheet) */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="lg:hidden">
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Preview
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-xl p-0">
            <SheetHeader className="px-4 pt-4">
              <SheetTitle>Dashboard Preview</SheetTitle>
            </SheetHeader>
            {previewPanel}
          </SheetContent>
        </Sheet>
      </div>

      {/* Split pane */}
      <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-2' : ''}`}>
        {/* Left: Config editor */}
        <ScrollArea className="max-h-[calc(100vh-180px)]">
          <div className="space-y-6 pr-2">
            <ConfigEditor config={draft} onChange={setDraft} onSave={() => void saveConfig()} saving={saving} isDirty={isDirty} />
            {draft?.id && <ShareLinks configId={draft.id} />}
          </div>
        </ScrollArea>

        {/* Right: Live preview (desktop only) */}
        {showPreview && (
          <div className="hidden lg:flex flex-col rounded-lg border bg-muted/10 overflow-hidden max-h-[calc(100vh-180px)]">
            {previewPanel}
          </div>
        )}
      </div>
    </div>
  );
}
