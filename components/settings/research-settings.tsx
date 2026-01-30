'use client';

import { useState, useEffect } from 'react';
import { Loader2, Bot, ChevronDown, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface ResearchSettingsProps {
  slug: string;
}

const ENTITY_TYPES: EntityType[] = ['organization', 'person', 'opportunity', 'rfp'];

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

export function ResearchSettingsPanel({ slug }: ResearchSettingsProps) {
  const [settings, setSettings] = useState<Record<EntityType, EntitySettings | null>>({
    organization: null,
    person: null,
    opportunity: null,
    rfp: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<EntityType | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<EntityType, boolean>>({
    organization: true,
    person: false,
    opportunity: false,
    rfp: false,
  });

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch(`/api/projects/${slug}/research-settings`);
        if (response.ok) {
          const data = await response.json();
          const settingsMap: Record<EntityType, EntitySettings | null> = {
            organization: null,
            person: null,
            opportunity: null,
            rfp: null,
          };

          for (const setting of data.settings) {
            settingsMap[setting.entity_type as EntityType] = {
              system_prompt: setting.system_prompt ?? '',
              user_prompt_template: setting.user_prompt_template ?? '',
              model_id: setting.model_id ?? 'anthropic/claude-3.5-sonnet',
              temperature: setting.temperature ?? 0.3,
              max_tokens: setting.max_tokens ?? 4096,
              default_confidence_threshold: setting.default_confidence_threshold ?? 0.7,
              auto_apply_high_confidence: setting.auto_apply_high_confidence ?? true,
              high_confidence_threshold: setting.high_confidence_threshold ?? 0.85,
            };
          }

          setSettings(settingsMap);
        }
      } catch (error) {
        console.error('Error loading research settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [slug]);

  const getSettingsForType = (entityType: EntityType): EntitySettings => {
    return settings[entityType] ?? {
      system_prompt: '',
      user_prompt_template: '',
      model_id: 'anthropic/claude-3.5-sonnet',
      temperature: 0.3,
      max_tokens: 4096,
      default_confidence_threshold: 0.7,
      auto_apply_high_confidence: true,
      high_confidence_threshold: 0.85,
    };
  };

  const updateSettingsForType = (entityType: EntityType, updates: Partial<EntitySettings>) => {
    setSettings((prev) => ({
      ...prev,
      [entityType]: {
        ...getSettingsForType(entityType),
        ...updates,
      },
    }));
  };

  const saveSettings = async (entityType: EntityType) => {
    setIsSaving(entityType);
    const entitySettings = getSettingsForType(entityType);

    try {
      const response = await fetch(`/api/projects/${slug}/research-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          system_prompt: entitySettings.system_prompt || null,
          user_prompt_template: entitySettings.user_prompt_template || null,
          model_id: entitySettings.model_id,
          temperature: entitySettings.temperature,
          max_tokens: entitySettings.max_tokens,
          default_confidence_threshold: entitySettings.default_confidence_threshold,
          auto_apply_high_confidence: entitySettings.auto_apply_high_confidence,
          high_confidence_threshold: entitySettings.high_confidence_threshold,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast.success(`${ENTITY_TYPE_LABELS[entityType]} research settings saved`);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(null);
    }
  };

  const resetToDefault = (entityType: EntityType, field: 'system_prompt' | 'user_prompt_template') => {
    const defaultValue = field === 'system_prompt'
      ? DEFAULT_SYSTEM_PROMPTS[entityType]
      : DEFAULT_USER_PROMPT_TEMPLATES[entityType];

    updateSettingsForType(entityType, { [field]: defaultValue });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Research Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Research Settings
        </CardTitle>
        <CardDescription>
          Customize AI research prompts and settings for each entity type.
          These settings control how AI extracts information for organizations, people, opportunities, and RFPs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="organization" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            {ENTITY_TYPES.map((entityType) => (
              <TabsTrigger key={entityType} value={entityType}>
                {ENTITY_TYPE_LABELS[entityType]}
              </TabsTrigger>
            ))}
          </TabsList>

          {ENTITY_TYPES.map((entityType) => {
            const entitySettings = getSettingsForType(entityType);

            return (
              <TabsContent key={entityType} value={entityType} className="space-y-6 pt-4">
                {/* Model Settings */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Model Settings</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>AI Model</Label>
                      <Select
                        value={entitySettings.model_id}
                        onValueChange={(value) => updateSettingsForType(entityType, { model_id: value })}
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
                        value={entitySettings.max_tokens}
                        onChange={(e) => updateSettingsForType(entityType, { max_tokens: parseInt(e.target.value) || 4096 })}
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label>Temperature: {entitySettings.temperature.toFixed(1)}</Label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={entitySettings.temperature}
                        onChange={(e) => updateSettingsForType(entityType, { temperature: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        Lower values produce more focused, deterministic results. Higher values increase creativity.
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
                        Default Confidence Threshold: {Math.round(entitySettings.default_confidence_threshold * 100)}%
                      </Label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={entitySettings.default_confidence_threshold}
                        onChange={(e) => updateSettingsForType(entityType, { default_confidence_threshold: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        High Confidence Threshold: {Math.round(entitySettings.high_confidence_threshold * 100)}%
                      </Label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={entitySettings.high_confidence_threshold}
                        onChange={(e) => updateSettingsForType(entityType, { high_confidence_threshold: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-normal">
                          Auto-apply High Confidence Results
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically apply results above the high confidence threshold
                        </p>
                      </div>
                      <Switch
                        checked={entitySettings.auto_apply_high_confidence}
                        onCheckedChange={(checked) => updateSettingsForType(entityType, { auto_apply_high_confidence: checked })}
                      />
                    </div>
                  </div>
                </div>

                {/* Prompt Templates */}
                <Collapsible
                  open={expandedSections[entityType]}
                  onOpenChange={(open) => setExpandedSections((prev) => ({ ...prev, [entityType]: open }))}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span>Custom Prompt Templates</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections[entityType] ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>System Prompt</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resetToDefault(entityType, 'system_prompt')}
                        >
                          <RotateCcw className="mr-2 h-3 w-3" />
                          Reset to Default
                        </Button>
                      </div>
                      <Textarea
                        value={entitySettings.system_prompt}
                        onChange={(e) => updateSettingsForType(entityType, { system_prompt: e.target.value })}
                        placeholder={DEFAULT_SYSTEM_PROMPTS[entityType]}
                        rows={6}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Sets the AI&apos;s role and behavior. Leave empty to use the default.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>User Prompt Template</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resetToDefault(entityType, 'user_prompt_template')}
                        >
                          <RotateCcw className="mr-2 h-3 w-3" />
                          Reset to Default
                        </Button>
                      </div>
                      <Textarea
                        value={entitySettings.user_prompt_template}
                        onChange={(e) => updateSettingsForType(entityType, { user_prompt_template: e.target.value })}
                        placeholder={DEFAULT_USER_PROMPT_TEMPLATES[entityType]}
                        rows={10}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Template for the research request. Use {`{{field_name}}`} for variable substitution.
                        Available variables depend on the entity type.
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={() => saveSettings(entityType)}
                    disabled={isSaving === entityType}
                  >
                    {isSaving === entityType && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save {ENTITY_TYPE_LABELS[entityType]} Settings
                  </Button>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
