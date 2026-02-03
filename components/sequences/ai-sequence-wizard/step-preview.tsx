'use client';

import { useState } from 'react';
import { Mail, Clock, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { GeneratedSequence } from '@/lib/validators/sequence';

interface StepPreviewProps {
  generatedSequence: GeneratedSequence | null;
  onUpdateSequence: (sequence: GeneratedSequence) => void;
}

export function StepPreview({
  generatedSequence,
  onUpdateSequence: _onUpdateSequence,
}: StepPreviewProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([1]));

  if (!generatedSequence) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Generating your sequence...</p>
      </div>
    );
  }

  const toggleStep = (stepNumber: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepNumber)) {
      newExpanded.delete(stepNumber);
    } else {
      newExpanded.add(stepNumber);
    }
    setExpandedSteps(newExpanded);
  };

  const emailSteps = generatedSequence.steps.filter((s) => s.step_type === 'email');
  const getDelayBefore = (emailIndex: number): { amount: number; unit: string } | null => {
    // Find the delay step that comes before this email
    const emailStep = emailSteps[emailIndex];
    if (!emailStep) return null;
    const emailStepNumber = emailStep.step_number;
    const delayStep = generatedSequence.steps.find(
      (s) => s.step_type === 'delay' && s.step_number === emailStepNumber - 1
    );
    if (delayStep && delayStep.delay_amount && delayStep.delay_unit) {
      return { amount: delayStep.delay_amount, unit: delayStep.delay_unit };
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{generatedSequence.sequence.name}</h3>
        <p className="text-sm text-muted-foreground">
          {generatedSequence.sequence.description}
        </p>
      </div>

      <div className="space-y-4">
        {emailSteps.map((step, emailIndex) => {
          const delay = getDelayBefore(emailIndex);
          const isExpanded = expandedSteps.has(step.step_number);

          return (
            <div key={step.step_number}>
              {/* Delay indicator */}
              {delay && (
                <div className="flex items-center gap-2 ml-4 mb-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    Wait {delay.amount} {delay.unit}
                  </span>
                </div>
              )}

              <Collapsible open={isExpanded} onOpenChange={() => toggleStep(step.step_number)}>
                <div className="border rounded-lg overflow-hidden">
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium">
                          {emailIndex + 1}
                        </div>
                        <div className="text-left">
                          <div className="font-medium">
                            Email {emailIndex + 1}
                          </div>
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {step.subject}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          <Mail className="h-3 w-3 mr-1" />
                          Email
                        </Badge>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t p-4 space-y-4">
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Subject
                        </div>
                        <div className="text-sm font-medium">
                          {step.subject}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Body
                        </div>
                        <div
                          className="prose prose-sm max-w-none text-sm bg-white text-black rounded p-3 [&_*]:!text-black [&_a]:!text-blue-600"
                          dangerouslySetInnerHTML={{ __html: step.body_html || '' }}
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          disabled
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerate (coming soon)
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </div>
          );
        })}
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-2">Personalization Variables</h4>
        <p className="text-sm text-muted-foreground">
          The emails include variables like <code className="bg-muted px-1 rounded">{'{{first_name}}'}</code> and{' '}
          <code className="bg-muted px-1 rounded">{'{{company_name}}'}</code> that will be replaced with actual
          recipient data when sent.
        </p>
      </div>
    </div>
  );
}
