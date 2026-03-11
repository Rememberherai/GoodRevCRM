'use client';

import { useState, useRef, useCallback } from 'react';
import { Save, Play, Pause, Users, Settings, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { StepTimeline } from './step-timeline';
import { StepEditor } from './step-editor';
import { EnrollPeopleDialog } from '../enrollment';
import type { Sequence, SequenceStep, SequenceStatus, SequenceSettings } from '@/types/sequence';
import {
  SEQUENCE_STATUS_LABELS,
  SEQUENCE_STATUS_COLORS,
  DEFAULT_CALL_CONFIG,
  DEFAULT_TASK_CONFIG,
  DEFAULT_LINKEDIN_CONFIG,
} from '@/types/sequence';

// Step types that can be added via UI
type AddableStepType = 'email' | 'delay' | 'sms' | 'call' | 'task' | 'linkedin';

interface SequenceBuilderProps {
  sequence: Sequence & { steps: SequenceStep[] };
  projectSlug: string;
  onSave: (updates: Partial<Sequence>) => Promise<void>;
  onSaveStep: (step: Partial<SequenceStep> & { id?: string }) => Promise<SequenceStep>;
  onDeleteStep: (stepId: string) => Promise<void>;
  onStatusChange: (status: SequenceStatus) => Promise<void>;
}

export function SequenceBuilder({
  sequence,
  projectSlug,
  onSave,
  onSaveStep,
  onDeleteStep,
  onStatusChange,
}: SequenceBuilderProps) {
  const [name, setName] = useState(sequence.name);
  const [description, setDescription] = useState(sequence.description || '');
  const [steps, setSteps] = useState(sequence.steps);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(
    steps.length > 0 ? steps[0]?.id ?? null : null
  );
  const [settings, setSettings] = useState<SequenceSettings>(sequence.settings);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false);
  const [_enrollmentCount, setEnrollmentCount] = useState(0);

  const selectedStep = steps.find((s) => s.id === selectedStepId) || null;

  const handleNameChange = (value: string) => {
    setName(value);
    setHasChanges(true);
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    setHasChanges(true);
  };

  const handleSettingChange = (key: keyof SequenceSettings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    // Flush any pending step saves first
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    for (const stepId of Object.keys(pendingUpdatesRef.current)) {
      await flushStepSave(stepId);
    }

    setIsSaving(true);
    try {
      await onSave({ name, description: description || null, settings });
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStepSelect = (stepId: string) => {
    // Flush pending save for current step before switching
    if (selectedStepId && pendingUpdatesRef.current[selectedStepId]) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      flushStepSave(selectedStepId);
    }
    setSelectedStepId(stepId);
  };

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = useRef<Record<string, Partial<SequenceStep>>>({});

  const flushStepSave = useCallback(async (stepId: string) => {
    const updates = pendingUpdatesRef.current[stepId];
    if (!updates) return;
    delete pendingUpdatesRef.current[stepId];
    try {
      await onSaveStep({ id: stepId, ...updates });
    } catch (err) {
      console.error('Failed to save step:', err);
    }
  }, [onSaveStep]);

  const handleStepUpdate = (updates: Partial<SequenceStep>) => {
    if (!selectedStepId) return;

    // Update local state immediately (optimistic)
    setSteps((prev) =>
      prev.map((s) => (s.id === selectedStepId ? { ...s, ...updates } : s))
    );

    // Accumulate pending updates for this step
    pendingUpdatesRef.current[selectedStepId] = {
      ...pendingUpdatesRef.current[selectedStepId],
      ...updates,
    };

    setHasChanges(true);

    // Debounce the server save
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    const stepId = selectedStepId;
    saveTimerRef.current = setTimeout(() => {
      flushStepSave(stepId);
    }, 500);
  };

  const handleAddStep = async (type: AddableStepType, afterStepNumber: number) => {
    // Build defaults based on step type
    const stepDefaults: Partial<SequenceStep> = {
      step_type: type,
      step_number: afterStepNumber + 1,
    };

    switch (type) {
      case 'email':
        stepDefaults.subject = 'New Email';
        stepDefaults.body_html = '<p>Email content here...</p>';
        break;
      case 'delay':
        stepDefaults.delay_amount = 2;
        stepDefaults.delay_unit = 'days';
        break;
      case 'sms':
        stepDefaults.sms_body = 'Hi {{first_name}}, ';
        break;
      case 'call':
        stepDefaults.config = { ...DEFAULT_CALL_CONFIG };
        break;
      case 'task':
        stepDefaults.config = { ...DEFAULT_TASK_CONFIG };
        break;
      case 'linkedin':
        stepDefaults.config = { ...DEFAULT_LINKEDIN_CONFIG };
        break;
    }

    const newStep = await onSaveStep(stepDefaults);

    // The server shifts step_numbers for us when inserting in the middle.
    // Update local state to match: increment step_number for steps >= insertion point
    const insertionPoint = afterStepNumber + 1;
    const updatedSteps = steps.map((s) => {
      if (s.step_number >= insertionPoint) {
        return { ...s, step_number: s.step_number + 1 };
      }
      return s;
    });
    updatedSteps.push(newStep);
    updatedSteps.sort((a, b) => a.step_number - b.step_number);

    setSteps(updatedSteps);
    setSelectedStepId(newStep.id);
  };

  const handleDeleteStep = async (stepId: string) => {
    await onDeleteStep(stepId);
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
    if (selectedStepId === stepId) {
      setSelectedStepId(steps[0]?.id || null);
    }
  };

  const canActivate = sequence.status === 'draft' || sequence.status === 'paused';
  const canPause = sequence.status === 'active';
  const canEnroll = sequence.status === 'active';

  const handleEnrolled = (count: number) => {
    setEnrollmentCount((prev) => prev + count);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectSlug}/sequences`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0"
              placeholder="Sequence name"
            />
          </div>
          <Badge className={SEQUENCE_STATUS_COLORS[sequence.status]}>
            {SEQUENCE_STATUS_LABELS[sequence.status]}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {canEnroll && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEnrollDialogOpen(true)}
            >
              <Users className="h-4 w-4 mr-2" />
              Enroll People
            </Button>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Sequence Settings</h4>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="send-as-reply" className="text-sm flex-1 pr-4">
                    Send as reply
                    <p className="text-xs text-muted-foreground font-normal mt-0.5">
                      Follow-up emails thread as replies to the first email
                    </p>
                  </Label>
                  <Switch
                    id="send-as-reply"
                    checked={settings.send_as_reply}
                    onCheckedChange={(v) => handleSettingChange('send_as_reply', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="stop-on-reply" className="text-sm flex-1 pr-4">
                    Stop on reply
                    <p className="text-xs text-muted-foreground font-normal mt-0.5">
                      Stop sequence when recipient replies
                    </p>
                  </Label>
                  <Switch
                    id="stop-on-reply"
                    checked={settings.stop_on_reply}
                    onCheckedChange={(v) => handleSettingChange('stop_on_reply', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="stop-on-bounce" className="text-sm flex-1 pr-4">
                    Stop on bounce
                    <p className="text-xs text-muted-foreground font-normal mt-0.5">
                      Stop sequence when email bounces
                    </p>
                  </Label>
                  <Switch
                    id="stop-on-bounce"
                    checked={settings.stop_on_bounce}
                    onCheckedChange={(v) => handleSettingChange('stop_on_bounce', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="track-opens" className="text-sm flex-1 pr-4">
                    Track opens
                  </Label>
                  <Switch
                    id="track-opens"
                    checked={settings.track_opens}
                    onCheckedChange={(v) => handleSettingChange('track_opens', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="track-clicks" className="text-sm flex-1 pr-4">
                    Track clicks
                  </Label>
                  <Switch
                    id="track-clicks"
                    checked={settings.track_clicks}
                    onCheckedChange={(v) => handleSettingChange('track_clicks', v)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Click Save to apply changes.</p>
              </div>
            </PopoverContent>
          </Popover>

          {canActivate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatusChange('active')}
            >
              <Play className="h-4 w-4 mr-2" />
              Activate
            </Button>
          )}

          {canPause && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatusChange('paused')}
            >
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Description */}
      <div className="p-4 border-b">
        <Textarea
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="Add a description for this sequence..."
          className="resize-none"
          rows={2}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Step timeline */}
        <div className="w-80 border-r overflow-auto">
          <StepTimeline
            steps={steps}
            selectedStepId={selectedStepId}
            onSelectStep={handleStepSelect}
            onAddStep={handleAddStep}
            onDeleteStep={handleDeleteStep}
          />
        </div>

        {/* Step editor */}
        <div className="flex-1 overflow-auto">
          {selectedStep ? (
            <StepEditor
              step={selectedStep}
              onUpdate={handleStepUpdate}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a step to edit
            </div>
          )}
        </div>
      </div>

      {/* Enroll People Dialog */}
      <EnrollPeopleDialog
        open={isEnrollDialogOpen}
        onOpenChange={setIsEnrollDialogOpen}
        projectSlug={projectSlug}
        sequenceId={sequence.id}
        onEnrolled={handleEnrolled}
      />
    </div>
  );
}
