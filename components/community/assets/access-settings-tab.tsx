'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MemberCombobox } from '@/components/ui/member-combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, Loader2, Plus, Trash2, X, MessageSquare } from 'lucide-react';
import type { CustomQuestion, QuestionType } from '@/types/calendar';

interface AccessSettings {
  access_mode: string;
  access_enabled: boolean;
  approval_policy: string;
  concurrent_capacity: number;
  booking_owner_user_id: string | null;
  return_required: boolean;
  resource_slug: string | null;
  public_name: string | null;
  public_description: string | null;
  public_visibility: string;
  access_instructions: string | null;
  custom_questions: CustomQuestion[];
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: 'Short Text',
  textarea: 'Long Text',
  select: 'Dropdown',
  radio: 'Radio Buttons',
  checkbox: 'Checkbox',
  phone: 'Phone',
  email: 'Email',
};

interface HubInfo {
  slug: string;
  is_enabled: boolean;
}

const DEFAULT_SETTINGS: AccessSettings = {
  access_mode: 'tracked_only',
  access_enabled: false,
  approval_policy: 'open_auto',
  concurrent_capacity: 1,
  booking_owner_user_id: null,
  return_required: false,
  resource_slug: null,
  public_name: null,
  public_description: null,
  public_visibility: 'unlisted',
  access_instructions: null,
  custom_questions: [],
};

export function AccessSettingsTab({ assetId }: { assetId: string }) {
  const { slug } = useParams<{ slug: string }>();
  const [settings, setSettings] = useState<AccessSettings>(DEFAULT_SETTINGS);
  const [hub, setHub] = useState<HubInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const lastSavedRef = useRef<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/projects/${slug}/community-assets/${assetId}/access-settings`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load access settings');
      }
      const loaded = {
        ...data.settings,
        custom_questions: Array.isArray(data.settings.custom_questions) ? data.settings.custom_questions : [],
      };
      setSettings(loaded);
      lastSavedRef.current = JSON.stringify(loaded);
      setHub(data.hub ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load access settings';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [slug, assetId]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const doSave = useCallback(async (settingsToSave: AccessSettings) => {
    setSaving(true);
    setSaved(false);
    try {
      // Clean custom questions: strip incomplete entries and stale options
      const cleanedQuestions = settingsToSave.custom_questions
        .filter((q) => q.label.trim())
        .map((q) => {
          if (q.type !== 'select' && q.type !== 'radio') {
            const { options: _, ...rest } = q;
            return rest;
          }
          return { ...q, options: (q.options ?? []).filter((o) => o.trim()) };
        });

      const payload = { ...settingsToSave, custom_questions: cleanedQuestions };

      const res = await fetch(
        `/api/projects/${slug}/community-assets/${assetId}/access-settings`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      const data = await res.json().catch(() => ({}));
      if (data.asset) {
        const merged = {
          ...settingsToSave,
          ...data.asset,
          // Keep local questions state (may include in-progress edits)
          custom_questions: settingsToSave.custom_questions,
        };
        lastSavedRef.current = JSON.stringify({
          ...merged,
          custom_questions: Array.isArray(data.asset.custom_questions) ? data.asset.custom_questions : [],
        });
        setSettings(merged);
      } else {
        lastSavedRef.current = JSON.stringify(settingsToSave);
      }
      setSaved(true);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save access settings');
    } finally {
      setSaving(false);
    }
  }, [slug, assetId]);

  // Debounced autosave
  useEffect(() => {
    if (loading) return;
    const currentSnapshot = JSON.stringify(settings);
    if (currentSnapshot === lastSavedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void doSave(settings);
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [settings, loading, doSave]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const update = <K extends keyof AccessSettings>(key: K, value: AccessSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading access settings...
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {loadError}
          </div>
          <Button variant="outline" onClick={() => void fetchSettings()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Access Settings</CardTitle>
          {(saving || saved) && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {saving ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>
              ) : (
                <><Check className="h-3 w-3 text-emerald-500" /> Saved</>
              )}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {(!hub || !hub.is_enabled) && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
            <strong>{hub ? 'Hub disabled.' : 'Hub not configured.'}</strong> Go to{' '}
            <strong>Community Assets &rarr; Hub Settings</strong> to set up and enable the
            resource hub before public access features can be used.
          </div>
        )}

        {/* Enable Access */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="access_enabled">Enable Access</Label>
            <p className="text-sm text-muted-foreground">
              Allow community members to access this asset
            </p>
          </div>
          <Switch
            id="access_enabled"
            checked={settings.access_enabled}
            onCheckedChange={(val) => update('access_enabled', val)}
          />
        </div>

        {/* Access Mode */}
        <div className="space-y-2">
          <Label>Access Mode</Label>
          <Select
            value={settings.access_mode}
            onValueChange={(val) => update('access_mode', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tracked_only">Tracked Only</SelectItem>
              <SelectItem value="reservable">Reservable</SelectItem>
              <SelectItem value="loanable">Loanable</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Approval Policy */}
        <div className="space-y-2">
          <Label>Approval Policy</Label>
          <Select
            value={settings.approval_policy}
            onValueChange={(val) => update('approval_policy', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open_auto">Auto-approve</SelectItem>
              <SelectItem value="open_review">Requires Review</SelectItem>
              <SelectItem value="approved_only">Pre-approved Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Concurrent Capacity */}
        <div className="space-y-2">
          <Label htmlFor="concurrent_capacity">Concurrent Capacity</Label>
          <Input
            id="concurrent_capacity"
            type="number"
            min={1}
            value={settings.concurrent_capacity}
            onChange={(e) =>
              update('concurrent_capacity', Math.max(1, parseInt(e.target.value) || 1))
            }
          />
        </div>

        {/* Return Required */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="return_required">Require Return</Label>
            <p className="text-sm text-muted-foreground">
              Require the asset to be returned after use
            </p>
          </div>
          <Switch
            id="return_required"
            checked={settings.return_required}
            onCheckedChange={(val) => update('return_required', val)}
          />
        </div>

        {/* Booking Owner */}
        <div className="space-y-2">
          <Label>Booking Owner</Label>
          <p className="text-sm text-muted-foreground">
            Team member responsible for managing bookings for this asset
          </p>
          <MemberCombobox
            value={settings.booking_owner_user_id}
            onValueChange={(val) => update('booking_owner_user_id', val)}
            placeholder="Select a booking owner..."
          />
        </div>

        {/* Resource Slug */}
        <div className="space-y-2">
          <Label htmlFor="resource_slug">Public URL Slug</Label>
          <Input
            id="resource_slug"
            value={settings.resource_slug ?? ''}
            onChange={(e) => update('resource_slug', e.target.value || null)}
            placeholder="e.g. conference-room-a"
          />
        </div>

        {/* Public Name */}
        <div className="space-y-2">
          <Label htmlFor="public_name">Public Name</Label>
          <Input
            id="public_name"
            value={settings.public_name ?? ''}
            onChange={(e) => update('public_name', e.target.value || null)}
          />
        </div>

        {/* Public Description */}
        <div className="space-y-2">
          <Label htmlFor="public_description">Public Description</Label>
          <Textarea
            id="public_description"
            value={settings.public_description ?? ''}
            onChange={(e) => update('public_description', e.target.value || null)}
            rows={3}
          />
        </div>

        {/* Public Visibility */}
        <div className="space-y-2">
          <Label>Public Visibility</Label>
          <Select
            value={settings.public_visibility}
            onValueChange={(val) => update('public_visibility', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="listed">Listed</SelectItem>
              <SelectItem value="unlisted">Unlisted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Access Instructions */}
        <div className="space-y-2">
          <Label htmlFor="access_instructions">Access Instructions</Label>
          <Textarea
            id="access_instructions"
            value={settings.access_instructions ?? ''}
            onChange={(e) => update('access_instructions', e.target.value || null)}
            rows={3}
            placeholder="Instructions shown to users after their access is approved"
          />
        </div>

        {/* Asset-Level Intake Questions */}
        <div className="space-y-3 border-t pt-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Intake Questions
              </Label>
              <p className="text-sm text-muted-foreground">
                These questions appear on <strong>all</strong> booking options for this asset.
                Add option-specific questions in the Booking Options tab.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const newQ: CustomQuestion = {
                  id: crypto.randomUUID(),
                  label: '',
                  type: 'text',
                  required: false,
                };
                update('custom_questions', [...settings.custom_questions, newQ]);
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Question
            </Button>
          </div>

          {settings.custom_questions.length > 0 && (
            <div className="space-y-2">
              {settings.custom_questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-lg border bg-gray-50 p-3 dark:bg-gray-900"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Question label"
                        value={q.label}
                        onChange={(e) => {
                          const updated = [...settings.custom_questions];
                          updated[idx] = { ...q, label: e.target.value };
                          update('custom_questions', updated);
                        }}
                      />
                      <div className="flex items-center gap-3">
                        <Select
                          value={q.type}
                          onValueChange={(val: string) => {
                            const updated = [...settings.custom_questions];
                            updated[idx] = {
                              ...q,
                              type: val as QuestionType,
                              options: (val === 'select' || val === 'radio') ? (q.options?.length ? q.options : ['']) : undefined,
                            };
                            update('custom_questions', updated);
                          }}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(QUESTION_TYPE_LABELS) as [QuestionType, string][]).map(
                              ([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-1.5 text-xs">
                          <Checkbox
                            checked={q.required}
                            onCheckedChange={(checked) => {
                              const updated = [...settings.custom_questions];
                              updated[idx] = { ...q, required: !!checked };
                              update('custom_questions', updated);
                            }}
                          />
                          Required
                        </label>
                      </div>

                      {/* Options editor for select/radio */}
                      {(q.type === 'select' || q.type === 'radio') && (
                        <div className="space-y-1.5 pl-1">
                          <span className="text-xs text-muted-foreground">Options:</span>
                          {(q.options ?? ['']).map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-1">
                              <Input
                                className="h-7 text-xs"
                                placeholder={`Option ${optIdx + 1}`}
                                value={opt}
                                onChange={(e) => {
                                  const updated = [...settings.custom_questions];
                                  const newOpts = [...(q.options ?? [''])];
                                  newOpts[optIdx] = e.target.value;
                                  updated[idx] = { ...q, options: newOpts };
                                  update('custom_questions', updated);
                                }}
                              />
                              {(q.options ?? []).length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
                                  onClick={() => {
                                    const updated = [...settings.custom_questions];
                                    const newOpts = (q.options ?? []).filter((_, i) => i !== optIdx);
                                    updated[idx] = { ...q, options: newOpts };
                                    update('custom_questions', updated);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => {
                              const updated = [...settings.custom_questions];
                              updated[idx] = { ...q, options: [...(q.options ?? []), ''] };
                              update('custom_questions', updated);
                            }}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Add Option
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Delete */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      title="Remove question"
                      onClick={() => {
                        update(
                          'custom_questions',
                          settings.custom_questions.filter((_, i) => i !== idx)
                        );
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
