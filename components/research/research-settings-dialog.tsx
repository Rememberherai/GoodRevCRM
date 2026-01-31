'use client';

import { useState, useEffect } from 'react';
import { Loader2, Bot, ChevronDown, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  DEFAULT_SYSTEM_PROMPTS,
  DEFAULT_USER_PROMPT_TEMPLATES,
} from '@/types/research';
import { ENTITY_TYPE_LABELS, type EntityType } from '@/types/custom-field';

interface ResearchSettingsDialogProps {
  slug: string;
  entityType: EntityType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODEL_OPTIONS = [
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { id: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku (Faster)' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (Faster)' },
  { id: 'google/gemini-pro-1.5', label: 'Gemini Pro 1.5' },
];

interface EntitySettings {
  system_prompt: string;
  user_prompt_template: string;
  model_id: string;
  temperature: number;
  max_tokens: number;
  default_confidence_threshold: number;
  auto_apply_high_confidence: boolean;
  high_confidence_threshold: number;
}

// Helper to get default settings for an entity type
const getDefaultSettings = (entityType: EntityType): EntitySettings => ({
  system_prompt: DEFAULT_SYSTEM_PROMPTS[entityType] ?? '',
  user_prompt_template: DEFAULT_USER_PROMPT_TEMPLATES[entityType] ?? '',
  model_id: 'anthropic/claude-3.5-sonnet',
  temperature: 0.3,
  max_tokens: 4096,
  default_confidence_threshold: 0.7,
  auto_apply_high_confidence: true,
  high_confidence_threshold: 0.85,
});

export function ResearchSettingsDialog({
  slug,
  entityType,
  open,
  onOpenChange,
}: ResearchSettingsDialogProps) {
  const defaultSettings = getDefaultSettings(entityType);
  const [settings, setSettings] = useState<EntitySettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedPrompts, setExpandedPrompts] = useState(false);

  // Load settings when dialog opens
  useEffect(() => {
    if (!open) return;

    const loadSettings = async () => {
      setIsLoading(true);
      const defaults = getDefaultSettings(entityType);
      try {
        const response = await fetch(`/api/projects/${slug}/research-settings`);
        if (response.ok) {
          const data = await response.json();
          const entitySettings = data.settings.find(
            (s: { entity_type: string }) => s.entity_type === entityType
          );

          if (entitySettings) {
            // Use saved values, falling back to defaults for prompts if empty/null
            setSettings({
              system_prompt: entitySettings.system_prompt || defaults.system_prompt,
              user_prompt_template: entitySettings.user_prompt_template || defaults.user_prompt_template,
              model_id: entitySettings.model_id ?? 'anthropic/claude-3.5-sonnet',
              temperature: entitySettings.temperature ?? 0.3,
              max_tokens: entitySettings.max_tokens ?? 4096,
              default_confidence_threshold: entitySettings.default_confidence_threshold ?? 0.7,
              auto_apply_high_confidence: entitySettings.auto_apply_high_confidence ?? true,
              high_confidence_threshold: entitySettings.high_confidence_threshold ?? 0.85,
            });
          } else {
            setSettings(defaults);
          }
        } else {
          setSettings(defaults);
        }
      } catch (error) {
        console.error('Error loading research settings:', error);
        setSettings(defaults);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [slug, entityType, open]);

  const updateSettings = (updates: Partial<EntitySettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const saveSettings = async () => {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/projects/${slug}/research-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          system_prompt: settings.system_prompt || null,
          user_prompt_template: settings.user_prompt_template || null,
          model_id: settings.model_id,
          temperature: settings.temperature,
          max_tokens: settings.max_tokens,
          default_confidence_threshold: settings.default_confidence_threshold,
          auto_apply_high_confidence: settings.auto_apply_high_confidence,
          high_confidence_threshold: settings.high_confidence_threshold,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast.success(`${ENTITY_TYPE_LABELS[entityType]} research settings saved`);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefault = (field: 'system_prompt' | 'user_prompt_template') => {
    const defaultValue =
      field === 'system_prompt'
        ? DEFAULT_SYSTEM_PROMPTS[entityType]
        : DEFAULT_USER_PROMPT_TEMPLATES[entityType];

    updateSettings({ [field]: defaultValue });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {ENTITY_TYPE_LABELS[entityType]} Research Settings
          </DialogTitle>
          <DialogDescription>
            Customize AI research prompts and settings for {ENTITY_TYPE_LABELS[entityType].toLowerCase()} research.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Model Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Model Settings</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>AI Model</Label>
                  <Select
                    value={settings.model_id}
                    onValueChange={(value) => updateSettings({ model_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_OPTIONS.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    min={100}
                    max={16000}
                    value={settings.max_tokens}
                    onChange={(e) =>
                      updateSettings({ max_tokens: parseInt(e.target.value) || 4096 })
                    }
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>Temperature: {settings.temperature.toFixed(1)}</Label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(e) =>
                      updateSettings({ temperature: parseFloat(e.target.value) })
                    }
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower values produce more focused, deterministic results.
                  </p>
                </div>
              </div>
            </div>

            {/* Confidence Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Confidence Settings</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    Default Threshold: {Math.round(settings.default_confidence_threshold * 100)}%
                  </Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.default_confidence_threshold}
                    onChange={(e) =>
                      updateSettings({
                        default_confidence_threshold: parseFloat(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    High Confidence: {Math.round(settings.high_confidence_threshold * 100)}%
                  </Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.high_confidence_threshold}
                    onChange={(e) =>
                      updateSettings({
                        high_confidence_threshold: parseFloat(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-normal">Auto-apply High Confidence</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically apply results above threshold
                    </p>
                  </div>
                  <Switch
                    checked={settings.auto_apply_high_confidence}
                    onCheckedChange={(checked) =>
                      updateSettings({ auto_apply_high_confidence: checked })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Prompt Templates */}
            <Collapsible open={expandedPrompts} onOpenChange={setExpandedPrompts}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span>Custom Prompt Templates</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${expandedPrompts ? 'rotate-180' : ''}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>System Prompt</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resetToDefault('system_prompt')}
                    >
                      <RotateCcw className="mr-2 h-3 w-3" />
                      Reset
                    </Button>
                  </div>
                  <Textarea
                    value={settings.system_prompt}
                    onChange={(e) => updateSettings({ system_prompt: e.target.value })}
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>User Prompt Template</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resetToDefault('user_prompt_template')}
                    >
                      <RotateCcw className="mr-2 h-3 w-3" />
                      Reset
                    </Button>
                  </div>
                  <Textarea
                    value={settings.user_prompt_template}
                    onChange={(e) => updateSettings({ user_prompt_template: e.target.value })}
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Save Button */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={saveSettings} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
