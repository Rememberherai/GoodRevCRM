'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Key, Loader2, Save, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface MissingKey {
  key_name: string;
  label: string;
}

interface ApiKeysSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  missingKeys: MissingKey[];
  onKeySaved: () => void;
}

/**
 * Instructions and signup links for each API key.
 */
const KEY_GUIDES: Record<
  string,
  { steps: string[]; signupUrl: string; signupLabel: string; why: string }
> = {
  openrouter_api_key: {
    why: 'Powers AI chat, research summaries, email drafts, and other AI-driven features throughout the CRM.',
    steps: [
      'Create an account at OpenRouter.',
      'Go to Keys in your dashboard.',
      'Click "Create Key" and give it a name (e.g. your project name).',
      'Copy the key (starts with sk-or-v1-...) and paste it below.',
    ],
    signupUrl: 'https://openrouter.ai/keys',
    signupLabel: 'OpenRouter Dashboard',
  },
  fullenrich_api_key: {
    why: 'Enriches contacts and companies with verified emails, phone numbers, and firmographic data.',
    steps: [
      'Sign up for a FullEnrich account.',
      'Navigate to Settings → API.',
      'Generate a new API key.',
      'Copy the key and paste it below.',
    ],
    signupUrl: 'https://www.fullenrich.com',
    signupLabel: 'FullEnrich Website',
  },
  news_api_key: {
    why: 'Monitors news articles and press releases about your contacts and organizations.',
    steps: [
      'Register at NewsAPI.org.',
      'Your API key will be shown on the dashboard after sign-up.',
      'Copy the key and paste it below.',
    ],
    signupUrl: 'https://newsapi.org/register',
    signupLabel: 'NewsAPI Registration',
  },
  census_api_key: {
    why: 'Provides demographic and growth metrics for geographic analysis and territory planning.',
    steps: [
      'Request a free API key from the U.S. Census Bureau.',
      'You will receive the key via email.',
      'Copy the key and paste it below.',
    ],
    signupUrl: 'https://api.census.gov/data/key_signup.html',
    signupLabel: 'Census API Key Signup',
  },
};

export function ApiKeysSetupDialog({
  open,
  onOpenChange,
  slug,
  missingKeys,
  onKeySaved,
}: ApiKeysSetupDialogProps) {
  const [step, setStep] = useState<'intro' | 'keys'>('intro');
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('intro');
      setEditValues({});
      setShowValues({});
      setSavingKeys({});
      setSavedKeys(new Set());
    }
  }, [open]);

  const handleSave = useCallback(
    async (keyName: string) => {
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
          setSavedKeys((prev) => new Set(prev).add(keyName));
          setEditValues((prev) => ({ ...prev, [keyName]: '' }));
          onKeySaved();
        } else {
          const data = await res.json();
          toast.error(data.error || 'Failed to save API key');
        }
      } catch {
        toast.error('Failed to save API key');
      } finally {
        setSavingKeys((prev) => ({ ...prev, [keyName]: false }));
      }
    },
    [editValues, slug, onKeySaved]
  );

  const allSaved = missingKeys.length > 0 && missingKeys.every((k) => savedKeys.has(k.key_name));
  const defaultTab = missingKeys[0]?.key_name ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        {step === 'intro' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys Required
              </DialogTitle>
              <DialogDescription>
                Your administrator has disabled shared server API keys. Each project
                must configure its own keys to use AI and enrichment features.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                <p className="text-sm font-medium">What you need to do:</p>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
                  <li>
                    Set up API keys for each service your project uses.
                  </li>
                  <li>
                    Each key is stored encrypted and only used by this project.
                  </li>
                  <li>
                    You can update or remove keys anytime in Project Settings → API Keys.
                  </li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Missing keys ({missingKeys.length}):</p>
                <div className="flex flex-wrap gap-2">
                  {missingKeys.map((k) => (
                    <Badge key={k.key_name} variant="destructive" className="text-xs">
                      {k.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Later
              </Button>
              <Button onClick={() => setStep('keys')}>
                Configure Keys
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Configure API Keys
              </DialogTitle>
              <DialogDescription>
                Enter your API keys for each service below. Follow the instructions to obtain each key.
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue={defaultTab} className="mt-2">
              <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
                {missingKeys.map((k) => (
                  <TabsTrigger
                    key={k.key_name}
                    value={k.key_name}
                    className="text-xs relative"
                  >
                    {k.label.replace(' API Key', '').replace(' Key', '')}
                    {savedKeys.has(k.key_name) && (
                      <CheckCircle2 className="h-3 w-3 text-green-500 ml-1" />
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              {missingKeys.map((k) => {
                const guide = KEY_GUIDES[k.key_name];
                const showValue = showValues[k.key_name];
                const saving = savingKeys[k.key_name];
                const saved = savedKeys.has(k.key_name);

                return (
                  <TabsContent key={k.key_name} value={k.key_name} className="space-y-4 mt-4">
                    {saved ? (
                      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-4">
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-green-700 dark:text-green-400">
                            {k.label} configured
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-500">
                            This key has been saved and encrypted.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {guide && (
                          <div className="space-y-3">
                            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                              <p className="text-sm font-medium">Why is this needed?</p>
                              <p className="text-xs text-muted-foreground">{guide.why}</p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm font-medium">How to get this key:</p>
                              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-5">
                                {guide.steps.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ol>
                              <a
                                href={guide.signupUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {guide.signupLabel}
                              </a>
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label className="text-sm">{k.label}</Label>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Input
                                type={showValue ? 'text' : 'password'}
                                value={editValues[k.key_name] ?? ''}
                                onChange={(e) =>
                                  setEditValues((prev) => ({
                                    ...prev,
                                    [k.key_name]: e.target.value,
                                  }))
                                }
                                placeholder="Paste your API key here"
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
                                    [k.key_name]: !prev[k.key_name],
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
                              onClick={() => handleSave(k.key_name)}
                              disabled={saving || !editValues[k.key_name]?.trim()}
                            >
                              {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4 mr-1" />
                              )}
                              Save
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
            <div className="flex justify-between items-center mt-4">
              <Button variant="ghost" size="sm" onClick={() => setStep('intro')}>
                Back
              </Button>
              <Button
                onClick={() => onOpenChange(false)}
                variant={allSaved ? 'default' : 'outline'}
              >
                {allSaved ? 'Done' : 'Close'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
