'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Key, Loader2, Save, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface SecretEntry {
  key_name: string;
  label: string;
  description: string;
  placeholder: string;
  is_set: boolean;
  masked_value: string;
  updated_at: string | null;
  has_server_default: boolean;
  fallback_blocked?: boolean;
}

interface ProjectSecretsPanelProps {
  slug: string;
}

export function ProjectSecretsPanel({ slug }: ProjectSecretsPanelProps) {
  const [secrets, setSecrets] = useState<SecretEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const [deletingKeys, setDeletingKeys] = useState<Record<string, boolean>>({});

  const fetchSecrets = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/secrets`);
      if (res.ok) {
        const data = await res.json();
        setSecrets(data.secrets || []);
      }
    } catch {
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchSecrets();
  }, [fetchSecrets]);

  async function handleSave(keyName: string) {
    const value = editValues[keyName];
    if (!value?.trim()) {
      toast.error('Please enter a value');
      return;
    }

    setSavingKeys((prev) => ({ ...prev, [keyName]: true }));
    try {
      const res = await fetch(`/api/projects/${slug}/secrets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_name: keyName, value: value.trim() }),
      });

      if (res.ok) {
        toast.success('API key saved');
        setEditValues((prev) => ({ ...prev, [keyName]: '' }));
        setShowValues((prev) => ({ ...prev, [keyName]: false }));
        fetchSecrets();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save API key');
      }
    } catch {
      toast.error('Failed to save API key');
    } finally {
      setSavingKeys((prev) => ({ ...prev, [keyName]: false }));
    }
  }

  async function handleDelete(keyName: string) {
    setDeletingKeys((prev) => ({ ...prev, [keyName]: true }));
    try {
      const res = await fetch(`/api/projects/${slug}/secrets`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_name: keyName }),
      });

      if (res.ok) {
        toast.success('API key removed');
        fetchSecrets();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to remove API key');
      }
    } catch {
      toast.error('Failed to remove API key');
    } finally {
      setDeletingKeys((prev) => ({ ...prev, [keyName]: false }));
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Keys
        </CardTitle>
        <CardDescription>
          Configure API keys for third-party services. Keys are encrypted at rest.
          If no project key is set, the system may fall back to a server default if allowed by the administrator.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {secrets.map((secret) => {
          const showValue = showValues[secret.key_name];
          const saving = savingKeys[secret.key_name];
          const deleting = deletingKeys[secret.key_name];

          return (
            <div key={secret.key_name} className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">{secret.label}</Label>
                  <p className="text-xs text-muted-foreground">{secret.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {secret.is_set && (
                    <Badge variant="outline" className="gap-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Configured
                    </Badge>
                  )}
                  {!secret.is_set && secret.fallback_blocked && (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <AlertCircle className="h-3 w-3" />
                      Server fallback disabled
                    </Badge>
                  )}
                  {!secret.is_set && secret.has_server_default && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <AlertCircle className="h-3 w-3" />
                      Using server default
                    </Badge>
                  )}
                  {!secret.is_set && !secret.has_server_default && !secret.fallback_blocked && (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      Not configured
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showValue ? 'text' : 'password'}
                    value={editValues[secret.key_name] ?? ''}
                    onChange={(e) =>
                      setEditValues((prev) => ({ ...prev, [secret.key_name]: e.target.value }))
                    }
                    placeholder={
                      secret.is_set ? secret.masked_value : secret.placeholder
                    }
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() =>
                      setShowValues((prev) => ({
                        ...prev,
                        [secret.key_name]: !prev[secret.key_name],
                      }))
                    }
                  >
                    {showValue ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleSave(secret.key_name)}
                  disabled={saving || !editValues[secret.key_name]?.trim()}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>

                {secret.is_set && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(secret.key_name)}
                    disabled={deleting}
                    title="Remove project key"
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>

              {secret.is_set && secret.updated_at && (
                <p className="text-xs text-muted-foreground">
                  Last updated {new Date(secret.updated_at).toLocaleDateString()}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
