'use client';

import { Mail, Clock, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SequenceStep } from '@/types/sequence';
import { DELAY_UNIT_LABELS } from '@/types/sequence';

interface StepTimelineProps {
  steps: SequenceStep[];
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  onAddStep: (type: 'email' | 'delay', afterStepNumber: number) => void;
  onDeleteStep: (stepId: string) => void;
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

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">Steps</h3>
        <span className="text-sm text-muted-foreground">
          {steps.filter((s) => s.step_type === 'email').length} emails
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
            Add First Email
          </Button>
        </div>
      ) : (
        <>
          {sortedSteps.map((step) => (
            <div key={step.id}>
              <div
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                  selectedStepId === step.id
                    ? 'bg-primary/10 border border-primary'
                    : 'hover:bg-muted border border-transparent'
                )}
                onClick={() => onSelectStep(step.id)}
              >
                {step.step_type === 'email' ? (
                  <>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        Email {getEmailNumber(step)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {step.subject || 'No subject'}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">Wait</div>
                      <div className="text-xs text-muted-foreground">
                        {step.delay_amount} {step.delay_unit && DELAY_UNIT_LABELS[step.delay_unit].toLowerCase()}
                      </div>
                    </div>
                  </>
                )}

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
              <div className="flex items-center gap-2 py-2 px-3 opacity-0 hover:opacity-100 transition-opacity">
                <div className="flex-1 h-px bg-border" />
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
                  onClick={() => onAddStep('delay', step.step_number)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Delay
                </Button>
                <div className="flex-1 h-px bg-border" />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
