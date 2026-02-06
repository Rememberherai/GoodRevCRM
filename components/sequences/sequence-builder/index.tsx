'use client';

import { useState } from 'react';
import { Save, Play, Pause, Users, Settings, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StepTimeline } from './step-timeline';
import { StepEditor } from './step-editor';
import { EnrollPeopleDialog } from '../enrollment';
import type { Sequence, SequenceStep, SequenceStatus } from '@/types/sequence';
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ name, description: description || null });
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStepSelect = (stepId: string) => {
    setSelectedStepId(stepId);
  };

  const handleStepUpdate = async (updates: Partial<SequenceStep>) => {
    if (!selectedStepId) return;

    const updatedStep = await onSaveStep({ id: selectedStepId, ...updates });

    setSteps((prev) =>
      prev.map((s) => (s.id === selectedStepId ? { ...s, ...updatedStep } : s))
    );
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

    // Renumber steps after the new one
    const updatedSteps = [...steps];
    updatedSteps.forEach((s) => {
      if (s.step_number > afterStepNumber) {
        s.step_number += 1;
      }
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

          <Button variant="outline" size="sm" disabled>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>

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
