'use client';

import { useEffect, useState } from 'react';
import { AdminHeader } from '@/components/admin/admin-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface SystemSetting {
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings(data.settings ?? []);
        const values: Record<string, string> = {};
        for (const s of data.settings ?? []) {
          values[s.key] = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
        }
        setEditValues(values);
      })
      .finally(() => setLoading(false));
  }, []);

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
      }
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <><AdminHeader title="Settings" /><main className="flex-1 p-6"><p className="text-muted-foreground">Loading...</p></main></>;

  return (
    <>
      <AdminHeader title="Settings" />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">System Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No settings configured yet.</p>
            ) : (
              settings.map((s, i) => (
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
