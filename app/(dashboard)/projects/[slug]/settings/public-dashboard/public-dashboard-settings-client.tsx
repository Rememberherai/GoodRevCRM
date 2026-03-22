'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfigEditor, type EditablePublicDashboardConfig } from '@/components/community/public-dashboard/config-editor';
import { ShareLinks } from '@/components/community/public-dashboard/share-links';
import { PublishControls } from '@/components/community/public-dashboard/publish-controls';

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

export function PublicDashboardSettingsClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [configs, setConfigs] = useState<ConfigRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditablePublicDashboardConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const loadConfigs = useCallback(async (selectId?: string | null) => {
    const response = await fetch(`/api/projects/${slug}/public-dashboard`);
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
      setDraft(toEditableConfig(matched));
    }
  }, [slug]);

  useEffect(() => {
    void loadConfigs(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function createConfig() {
    const payload = toEditableConfig();
    const response = await fetch(`/api/projects/${slug}/public-dashboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json() as { config?: ConfigRecord };
    if (response.ok && data.config) {
      setSelectedId(data.config.id);
      await loadConfigs(data.config.id);
    }
  }

  function buildPayload(source: EditablePublicDashboardConfig) {
    // Strip client-only fields (id) and normalize empty strings
    const { id: _id, password, hero_image_url, ...rest } = source;
    return {
      ...rest,
      hero_image_url: hero_image_url || null,
      ...(password ? { password } : {}),
    };
  }

  async function saveConfig() {
    if (!draft) return;
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
  }

  async function handleStatusChange(status: ConfigRecord['status']) {
    if (!draft) return;
    setSaving(true);
    try {
      let configId = draft.id;

      // If the config hasn't been saved yet, create it with the new status
      if (!configId) {
        const createPayload = buildPayload({ ...draft, status });
        const createResponse = await fetch(`/api/projects/${slug}/public-dashboard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload),
        });
        const createData = await createResponse.json() as { config?: ConfigRecord; error?: string };
        if (!createResponse.ok || !createData.config) {
          toast.error(createData.error ?? 'Failed to save dashboard');
          return;
        }
        configId = createData.config.id;
        setSelectedId(configId);
        setDraft({ ...draft, id: configId, status });
        await loadConfigs(configId);
        toast.success(`Dashboard ${status}`);
        return;
      }

      const nextDraft = { ...draft, status };
      setDraft(nextDraft);
      const response = await fetch(`/api/projects/${slug}/public-dashboard/${configId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(nextDraft)),
      });
      const data = await response.json() as { config?: ConfigRecord; error?: string };
      if (response.ok && data.config) {
        await loadConfigs(configId);
        toast.success(`Dashboard ${status}`);
      } else {
        toast.error(data.error ?? 'Failed to update status');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Public Dashboard</h2>
          <p className="text-sm text-muted-foreground">Configure unauthenticated, aggregate-only community impact pages.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/projects/${slug}/public-dashboard-preview`}>
              <Eye className="mr-2 h-4 w-4" />
              View Sample Preview
            </Link>
          </Button>
          <Button onClick={() => void createConfig()}>
            <Plus className="mr-2 h-4 w-4" />
            New Dashboard
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Configs</CardTitle>
            <CardDescription>Draft, preview, published, and archived dashboards.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {configs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No public dashboards yet.</div>
            ) : (
              configs.map((config) => (
                <button
                  key={config.id}
                  onClick={() => {
                    setSelectedId(config.id);
                    setDraft(toEditableConfig(config));
                  }}
                  className={`w-full rounded-lg border p-3 text-left ${selectedId === config.id ? 'border-primary bg-primary/5' : ''}`}
                >
                  <div className="font-medium">{config.title}</div>
                  <div className="text-xs text-muted-foreground">{config.status} • /public/{slug}/{config.slug}</div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <PublishControls status={draft?.status ?? 'draft'} disabled={saving} onStatusChange={(status) => void handleStatusChange(status)} />
          <ConfigEditor config={draft} onChange={setDraft} onSave={() => void saveConfig()} />
          <ShareLinks configId={draft?.id} />
        </div>
      </div>
    </div>
  );
}
