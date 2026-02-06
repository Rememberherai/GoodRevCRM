'use client';

import { Mail, Clock, Plus, Trash2, MessageSquare, Phone, CheckSquare, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SequenceStep, StepType, CallStepConfig, TaskStepConfig, LinkedInStepConfig } from '@/types/sequence';
import { DELAY_UNIT_LABELS, STEP_TYPE_LABELS, STEP_TYPE_COLORS, LINKEDIN_ACTION_LABELS } from '@/types/sequence';

// All step types that can be added
type AddableStepType = 'email' | 'delay' | 'sms' | 'call' | 'task' | 'linkedin';

interface StepTimelineProps {
  steps: SequenceStep[];
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  onAddStep: (type: AddableStepType, afterStepNumber: number) => void;
  onDeleteStep: (stepId: string) => void;
}

// Get the icon component for a step type
function getStepIcon(stepType: StepType) {
  switch (stepType) {
    case 'email': return Mail;
    case 'delay': return Clock;
    case 'sms': return MessageSquare;
    case 'call': return Phone;
    case 'task': return CheckSquare;
    case 'linkedin': return Linkedin;
    case 'condition': return Clock; // fallback
    default: return Mail;
  }
}

export function StepTimeline({
  steps,
  selectedStepId,
  onSelectStep,
  onAddStep,
  onDeleteStep,
}: StepTimelineProps) {
  const sortedSteps = [...steps].sort((a, b) => a.step_number - b.step_number);

  const getEmailNumber = (step: SequenceStep) => {
    const emailSteps = sortedSteps.filter((s) => s.step_type === 'email');
    return emailSteps.findIndex((s) => s.id === step.id) + 1;
  };

  const getSmsNumber = (step: SequenceStep) => {
    const smsSteps = sortedSteps.filter((s) => s.step_type === 'sms');
    return smsSteps.findIndex((s) => s.id === step.id) + 1;
  };

  // Get the subtitle for a step
  const getStepSubtitle = (step: SequenceStep): string => {
    switch (step.step_type) {
      case 'email':
        return step.subject || 'No subject';
      case 'delay':
        return `${step.delay_amount || 1} ${step.delay_unit ? DELAY_UNIT_LABELS[step.delay_unit].toLowerCase() : 'days'}`;
      case 'sms':
        return step.sms_body?.slice(0, 50) || 'No message';
      case 'call': {
        const callConfig = step.config as CallStepConfig | null;
        return callConfig?.title?.slice(0, 40) || 'Call contact';
      }
      case 'task': {
        const taskConfig = step.config as TaskStepConfig | null;
        return taskConfig?.title?.slice(0, 40) || 'Complete task';
      }
      case 'linkedin': {
        const linkedinConfig = step.config as LinkedInStepConfig | null;
        if (linkedinConfig?.action) {
          return LINKEDIN_ACTION_LABELS[linkedinConfig.action];
        }
        return 'LinkedIn action';
      }
      default:
        return '';
    }
  };

  // Get the title for a step
  const getStepTitle = (step: SequenceStep): string => {
    switch (step.step_type) {
      case 'email':
        return `Email ${getEmailNumber(step)}`;
      case 'sms':
        return `SMS ${getSmsNumber(step)}`;
      default:
        return STEP_TYPE_LABELS[step.step_type];
    }
  };

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">Steps</h3>
        <span className="text-sm text-muted-foreground">
          {steps.length} steps
        </span>
      </div>

      {sortedSteps.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="mb-4">No steps yet</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddStep('email', 0)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add First Step
          </Button>
        </div>
      ) : (
        <>
          {sortedSteps.map((step) => {
            const Icon = getStepIcon(step.step_type);
            const colors = STEP_TYPE_COLORS[step.step_type];

            return (
              <div key={step.id}>
                <div
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors group',
                    selectedStepId === step.id
                      ? 'bg-primary/10 border border-primary'
                      : 'hover:bg-muted border border-transparent'
                  )}
                  onClick={() => onSelectStep(step.id)}
                >
                  <div className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full',
                    colors.bg,
                    colors.text
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {getStepTitle(step)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {getStepSubtitle(step)}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteStep(step.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Add step buttons */}
                <div className="flex flex-wrap items-center gap-1 py-2 px-3 opacity-0 hover:opacity-100 transition-opacity">
                  <div className="flex-1 h-px bg-border min-w-[20px]" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onAddStep('email', step.step_number)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Email
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onAddStep('sms', step.step_number)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    SMS
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onAddStep('delay', step.step_number)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Wait
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onAddStep('call', step.step_number)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Call
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onAddStep('task', step.step_number)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Task
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onAddStep('linkedin', step.step_number)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    LinkedIn
                  </Button>
                  <div className="flex-1 h-px bg-border min-w-[20px]" />
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
