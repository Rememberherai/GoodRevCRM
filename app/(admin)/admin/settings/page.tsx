'use client';

import { useEffect, useState } from 'react';
import { AdminHeader } from '@/components/admin/admin-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface SystemSetting {
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: string;
}

/** Keys managed by dedicated UI — hidden from the generic key-value editor. */
const MANAGED_SETTING_KEYS = new Set(['require_project_api_keys']);

/**
 * Per-key fallback toggles shown in the admin UI.
 * Maps the policy key (stored in the JSONB object) to a human-readable label.
 * Only non-hidden, user-facing API keys belong here.
 */
const FALLBACK_KEYS: { policyKey: string; label: string; description: string }[] = [
  { policyKey: 'openrouter', label: 'OpenRouter', description: 'AI/LLM provider for chat, research, and AI features' },
  { policyKey: 'fullenrich', label: 'FullEnrich', description: 'Contact and company data enrichment' },
  { policyKey: 'news', label: 'News API', description: 'News feed and company news monitoring' },
  { policyKey: 'census', label: 'Census API', description: 'Growth metrics and census data enrichment' },
];

type FallbackPolicy = Record<string, boolean>;

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  // Dedicated state for API key fallback policy
  // Each key is true when fallback is *required* (i.e. fallback blocked).
  // "all" is a master switch.
  const [fallbackPolicy, setFallbackPolicy] = useState<FallbackPolicy>({});

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        const allSettings: SystemSetting[] = data.settings ?? [];
        setSettings(allSettings);
        const values: Record<string, string> = {};
        for (const s of allSettings) {
          values[s.key] = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
        }
        setEditValues(values);

        // Parse the require_project_api_keys setting
        const apiKeySetting = allSettings.find((s) => s.key === 'require_project_api_keys');
        if (apiKeySetting?.value && typeof apiKeySetting.value === 'object') {
          setFallbackPolicy(apiKeySetting.value as FallbackPolicy);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  /** Persist the entire fallback policy object to the DB. */
  const saveFallbackPolicy = async (newPolicy: FallbackPolicy) => {
    setSaving('require_project_api_keys');
    const previousPolicy = { ...fallbackPolicy };
    setFallbackPolicy(newPolicy);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'require_project_api_keys', value: newPolicy }),
      });

      if (res.ok) {
        toast.success('API key fallback policy updated');
        setSettings((prev) =>
          prev.map((s) =>
            s.key === 'require_project_api_keys'
              ? { ...s, value: newPolicy, updated_at: new Date().toISOString() }
              : s
          )
        );
      } else {
        setFallbackPolicy(previousPolicy);
        toast.error('Failed to update setting');
      }
    } catch {
      setFallbackPolicy(previousPolicy);
      toast.error('Failed to update setting');
    } finally {
      setSaving(null);
    }
  };

  const handleToggleAll = (enabled: boolean) => {
    // enabled = fallback allowed → all = false
    // disabled = fallback blocked → all = true
    saveFallbackPolicy({ ...fallbackPolicy, all: !enabled });
  };

  const handleToggleKey = (policyKey: string, enabled: boolean) => {
    saveFallbackPolicy({ ...fallbackPolicy, [policyKey]: !enabled });
  };

  const masterEnabled = !fallbackPolicy.all;

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      let parsedValue: unknown = editValues[key];
      try {
        parsedValue = JSON.parse(editValues[key] ?? '');
      } catch {
        // keep as string
      }

      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: parsedValue }),
      });

      if (res.ok) {
        setSettings((prev) =>
          prev.map((s) => (s.key === key ? { ...s, value: parsedValue, updated_at: new Date().toISOString() } : s))
        );
        toast.success('Setting saved');
      } else {
        toast.error('Failed to save setting');
      }
    } finally {
      setSaving(null);
    }
  };

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    setSaving('__new__');
    try {
      let parsedValue: unknown = newValue;
      try {
        parsedValue = JSON.parse(newValue);
      } catch {
        // keep as string
      }

      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newKey, value: parsedValue }),
      });

      if (res.ok) {
        const newSetting = { key: newKey, value: parsedValue, updated_by: null, updated_at: new Date().toISOString() };
        setSettings((prev) => {
          const exists = prev.findIndex((s) => s.key === newKey);
          if (exists >= 0) {
            const updated = [...prev];
            updated[exists] = newSetting;
            return updated;
          }
          return [...prev, newSetting];
        });
        setEditValues((prev) => ({ ...prev, [newKey]: newValue }));
        setNewKey('');
        setNewValue('');
        toast.success('Setting added');
      } else {
        toast.error('Failed to add setting');
      }
    } finally {
      setSaving(null);
    }
  };

  // Filter out managed settings from the generic editor
  const genericSettings = settings.filter((s) => !MANAGED_SETTING_KEYS.has(s.key));

  if (loading) return <><AdminHeader title="Settings" /><main className="flex-1 p-6"><p className="text-muted-foreground">Loading...</p></main></>;

  return (
    <>
      <AdminHeader title="Settings" />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        {/* API Key Fallback Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">API Server Key Fallback</CardTitle>
            <CardDescription>
              Control whether projects without their own API keys can fall back to
              the server&apos;s environment variable keys. Use the master toggle to
              control all keys at once, or configure each service individually.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Master toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">
                  Allow server key fallback for all services
                </Label>
                <p className="text-xs text-muted-foreground">
                  {masterEnabled
                    ? 'Master fallback is on. Individual services can still be disabled below.'
                    : 'Master fallback is off. No project will receive server keys regardless of per-service settings.'}
                </p>
              </div>
              <Switch
                checked={masterEnabled}
                onCheckedChange={handleToggleAll}
                disabled={saving === 'require_project_api_keys'}
              />
            </div>

            {/* Per-key toggles */}
            <div className="space-y-3 pl-4 border-l-2 border-muted ml-2">
              {FALLBACK_KEYS.map((fk) => {
                // If master is off, all keys are effectively blocked regardless
                const keyEnabled = masterEnabled && !fallbackPolicy[fk.policyKey];
                return (
                  <div key={fk.policyKey} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">{fk.label}</Label>
                      <p className="text-xs text-muted-foreground">{fk.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!masterEnabled && (
                        <span className="text-xs text-muted-foreground italic">blocked by master</span>
                      )}
                      <Switch
                        checked={keyEnabled}
                        onCheckedChange={(checked) => handleToggleKey(fk.policyKey, checked)}
                        disabled={saving === 'require_project_api_keys' || !masterEnabled}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Generic System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">System Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {genericSettings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No additional settings configured.</p>
            ) : (
              genericSettings.map((s, i) => (
                <div key={s.key}>
                  {i > 0 && <Separator className="mb-4" />}
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">{s.key}</Label>
                      <Input
                        value={editValues[s.key] ?? ''}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, [s.key]: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSave(s.key)}
                      disabled={saving === s.key}
                    >
                      {saving === s.key ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last updated: {new Date(s.updated_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Add Setting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label className="text-sm">Key</Label>
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="setting_key"
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label className="text-sm">Value</Label>
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="value (JSON or string)"
                  className="mt-1"
                />
              </div>
              <Button onClick={handleAdd} disabled={saving === '__new__' || !newKey.trim()}>
                {saving === '__new__' ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
