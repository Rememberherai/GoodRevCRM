'use client';

import { useState, useEffect } from 'react';
import {
  Loader2,
  GripVertical,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { PROVIDER_METADATA } from '@/lib/contact-providers/types';

interface ContactProvidersSettingsProps {
  slug: string;
}

interface ProviderState {
  enabled: boolean;
  priority: number;
  apiKey: string;
  apiKeyMasked: string;
  isNew: boolean;
  credits?: number | null;
  testing?: boolean;
  testResult?: 'success' | 'error' | null;
}

type ProviderName = 'leadmagic' | 'hunter' | 'prospeo' | 'apollo';

const PROVIDER_ORDER: ProviderName[] = ['leadmagic', 'hunter', 'prospeo', 'apollo'];

interface WaterfallSettings {
  stopOnFirstResult: boolean;
  minConfidence: number;
}

export function ContactProvidersSettings({ slug }: ContactProvidersSettingsProps) {
  const [providers, setProviders] = useState<Record<ProviderName, ProviderState>>({
    leadmagic: { enabled: false, priority: 1, apiKey: '', apiKeyMasked: '', isNew: true },
    hunter: { enabled: false, priority: 2, apiKey: '', apiKeyMasked: '', isNew: true },
    prospeo: { enabled: false, priority: 3, apiKey: '', apiKeyMasked: '', isNew: true },
    apollo: { enabled: false, priority: 4, apiKey: '', apiKeyMasked: '', isNew: true },
  });
  const [waterfall, setWaterfall] = useState<WaterfallSettings>({
    stopOnFirstResult: true,
    minConfidence: 0.5,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState<Record<ProviderName, boolean>>({
    leadmagic: false,
    hunter: false,
    prospeo: false,
    apollo: false,
  });

  useEffect(() => {
    loadSettings();
  }, [slug]);

  const loadSettings = async () => {
    try {
      const response = await fetch(`/api/projects/${slug}/settings/contact-providers`);
      if (response.ok) {
        const data = await response.json();

        if (data.providers) {
          const newProviders = { ...providers };
          for (const [name, config] of Object.entries(data.providers) as [
            ProviderName,
            { enabled: boolean; priority: number; apiKeyMasked?: string; credits?: number | null }
          ][]) {
            if (newProviders[name]) {
              newProviders[name] = {
                ...newProviders[name],
                enabled: config.enabled,
                priority: config.priority,
                apiKeyMasked: config.apiKeyMasked || '',
                isNew: !config.apiKeyMasked,
                credits: config.credits,
              };
            }
          }
          setProviders(newProviders);
        }

        if (data.waterfall) {
          setWaterfall(data.waterfall);
        }
      }
    } catch (error) {
      console.error('Failed to load contact provider settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        providers: {},
        waterfall,
      };

      for (const [name, state] of Object.entries(providers) as [ProviderName, ProviderState][]) {
        const providerPayload: Record<string, unknown> = {
          enabled: state.enabled,
          priority: state.priority,
        };

        // Only include API key if it's been changed (not empty and is new input)
        if (state.apiKey && state.apiKey.length > 0) {
          providerPayload.apiKey = state.apiKey;
        }

        (payload.providers as Record<string, unknown>)[name] = providerPayload;
      }

      const response = await fetch(`/api/projects/${slug}/settings/contact-providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save settings');
      }

      toast.success('Contact provider settings saved');

      // Reload to get updated masked keys
      await loadSettings();

      // Clear entered API keys
      setProviders((prev) => {
        const updated = { ...prev };
        for (const name of PROVIDER_ORDER) {
          updated[name] = { ...updated[name], apiKey: '' };
        }
        return updated;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async (name: ProviderName) => {
    setProviders((prev) => ({
      ...prev,
      [name]: { ...prev[name], testing: true, testResult: null },
    }));

    try {
      const response = await fetch(
        `/api/projects/${slug}/settings/contact-providers/test?provider=${name}`,
        { method: 'POST' }
      );

      const result = response.ok ? 'success' : 'error';
      setProviders((prev) => ({
        ...prev,
        [name]: { ...prev[name], testing: false, testResult: result },
      }));

      if (response.ok) {
        const data = await response.json();
        if (data.credits !== undefined) {
          setProviders((prev) => ({
            ...prev,
            [name]: { ...prev[name], credits: data.credits },
          }));
        }
        toast.success(`${PROVIDER_METADATA[name]?.displayName ?? name} connected successfully`);
      } else {
        toast.error(`Failed to connect to ${PROVIDER_METADATA[name]?.displayName ?? name}`);
      }
    } catch {
      setProviders((prev) => ({
        ...prev,
        [name]: { ...prev[name], testing: false, testResult: 'error' },
      }));
      toast.error(`Failed to test ${PROVIDER_METADATA[name]?.displayName ?? name} connection`);
    }
  };

  const toggleApiKeyVisibility = (name: ProviderName) => {
    setShowApiKeys((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const updateProvider = (name: ProviderName, updates: Partial<ProviderState>) => {
    setProviders((prev) => ({
      ...prev,
      [name]: { ...prev[name], ...updates },
    }));
  };

  // Sort providers by priority for display
  const sortedProviders = PROVIDER_ORDER.slice().sort(
    (a, b) => providers[a].priority - providers[b].priority
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Contact Discovery Providers</h3>
        <p className="text-sm text-muted-foreground">
          Configure which providers to use for finding contacts at organizations. Providers are
          tried in priority order until results are found.
        </p>
      </div>

      <div className="space-y-4">
        {sortedProviders.map((name) => {
          const state = providers[name];
          const meta = PROVIDER_METADATA[name];

          return (
            <Card key={name} className={!state.enabled ? 'opacity-60' : ''}>
              <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        {state.priority}.
                      </span>
                      <CardTitle className="text-base">{meta?.displayName ?? name}</CardTitle>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {state.testResult === 'success' && (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <Check className="h-4 w-4" />
                        Connected
                      </span>
                    )}
                    {state.testResult === 'error' && (
                      <span className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        Failed
                      </span>
                    )}
                    <Switch
                      checked={state.enabled}
                      onCheckedChange={(enabled) => updateProvider(name, { enabled })}
                    />
                  </div>
                </div>
                <CardDescription className="ml-8">
                  ~${(meta?.costPerContact ?? 0).toFixed(2)}/contact
                  {state.credits !== undefined && state.credits !== null && (
                    <span className="ml-2">• {state.credits.toLocaleString()} credits</span>
                  )}
                </CardDescription>
              </CardHeader>

              {state.enabled && (
                <CardContent className="pt-0 pb-4">
                  <div className="space-y-4 ml-8">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`${name}-priority`}>Priority</Label>
                        <Input
                          id={`${name}-priority`}
                          type="number"
                          min={1}
                          max={4}
                          value={state.priority}
                          onChange={(e) =>
                            updateProvider(name, { priority: parseInt(e.target.value) || 1 })
                          }
                          className="w-20"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${name}-apikey`}>API Key</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              id={`${name}-apikey`}
                              type={showApiKeys[name] ? 'text' : 'password'}
                              placeholder={state.apiKeyMasked || 'Enter API key'}
                              value={state.apiKey}
                              onChange={(e) => updateProvider(name, { apiKey: e.target.value })}
                            />
                            <button
                              type="button"
                              onClick={() => toggleApiKeyVisibility(name)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showApiKeys[name] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestConnection(name)}
                            disabled={state.testing || (!state.apiKey && state.isNew)}
                          >
                            {state.testing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Test'
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Waterfall Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Stop after first provider returns results</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, stops searching after the first provider finds contacts
              </p>
            </div>
            <Switch
              checked={waterfall.stopOnFirstResult}
              onCheckedChange={(checked) =>
                setWaterfall((prev) => ({ ...prev, stopOnFirstResult: checked }))
              }
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Minimum confidence threshold</Label>
              <span className="text-sm text-muted-foreground">
                {(waterfall.minConfidence * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[waterfall.minConfidence]}
              onValueChange={(values) => {
                const value = values[0];
                if (value !== undefined) {
                  setWaterfall((prev) => ({ ...prev, minConfidence: value }));
                }
              }}
              min={0}
              max={1}
              step={0.05}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              Only include contacts with confidence score above this threshold
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
