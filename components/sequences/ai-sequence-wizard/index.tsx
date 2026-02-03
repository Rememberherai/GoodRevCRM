'use client';

import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StepType } from './step-type';
import { StepContext } from './step-context';
import { StepGoals } from './step-goals';
import { StepPreview } from './step-preview';
import type {
  SequenceType,
  Tone,
  GeneratedSequence,
} from '@/lib/validators/sequence';
import type { CompanyContext } from '@/lib/validators/project';

interface AISequenceWizardProps {
  projectSlug: string;
  onComplete: (sequence: { id: string }) => void;
  onCancel: () => void;
  initialCompanyContext?: CompanyContext;
  organizationId?: string;
  organizationContext?: {
    name: string;
    domain?: string | null;
    description?: string | null;
  };
}

interface WizardState {
  // Step 1: Type
  sequenceType: SequenceType;
  tone: Tone;
  numberOfSteps: number;

  // Step 2: Context
  companyName: string;
  companyDescription: string;
  products: string[];
  valuePropositions: string[];

  // Step 3: Goals
  targetAudienceDescription: string;
  painPoints: string[];
  primaryCta: string;
  keyMessages: string[];

  // Generated content
  generatedSequence: GeneratedSequence | null;
}

const INITIAL_STATE: WizardState = {
  sequenceType: 'cold_outreach',
  tone: 'professional',
  numberOfSteps: 5,
  companyName: '',
  companyDescription: '',
  products: [],
  valuePropositions: [],
  targetAudienceDescription: '',
  painPoints: [],
  primaryCta: '',
  keyMessages: [],
  generatedSequence: null,
};

const STEPS = [
  { id: 'type', label: 'Type & Tone', description: 'Configure sequence type' },
  { id: 'context', label: 'Your Company', description: 'Describe your business' },
  { id: 'goals', label: 'Campaign Goals', description: 'Define your objectives' },
  { id: 'preview', label: 'Preview & Edit', description: 'Review and customize' },
];

export function AISequenceWizard({
  projectSlug,
  onComplete,
  onCancel,
  initialCompanyContext,
  organizationId,
  organizationContext,
}: AISequenceWizardProps) {
  // Build initial state from props
  const buildInitialState = (): WizardState => {
    // If org-specific, prefer org context, else use project context
    const contextName = organizationContext?.name || initialCompanyContext?.name || '';
    const contextDescription = organizationContext?.description || initialCompanyContext?.description || '';

    return {
      ...INITIAL_STATE,
      companyName: contextName,
      companyDescription: contextDescription,
      products: initialCompanyContext?.products || [],
      valuePropositions: initialCompanyContext?.value_propositions || [],
    };
  };

  const [currentStep, setCurrentStep] = useState(0);
  const [state, setState] = useState<WizardState>(buildInitialState);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateState = (updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Type
        return true; // All have defaults
      case 1: // Context
        return state.companyName.trim() !== '' && state.companyDescription.trim() !== '';
      case 2: // Goals
        return state.targetAudienceDescription.trim() !== '' && state.primaryCta.trim() !== '';
      case 3: // Preview
        return state.generatedSequence !== null;
      default:
        return false;
    }
  };

  const generateSequence = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectSlug}/sequences/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sequenceType: state.sequenceType,
          tone: state.tone,
          numberOfSteps: state.numberOfSteps,
          companyContext: {
            name: state.companyName,
            description: state.companyDescription,
            products: state.products.length > 0 ? state.products : undefined,
            valuePropositions: state.valuePropositions.length > 0 ? state.valuePropositions : undefined,
          },
          targetAudience: {
            description: state.targetAudienceDescription,
            painPoints: state.painPoints.length > 0 ? state.painPoints : undefined,
          },
          campaignGoals: {
            primaryCta: state.primaryCta,
            keyMessages: state.keyMessages.length > 0 ? state.keyMessages : undefined,
          },
          organizationId,
          preview: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate sequence');
      }

      const data = await response.json();
      updateState({
        generatedSequence: {
          sequence: data.sequence,
          steps: data.steps,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate sequence');
    } finally {
      setIsGenerating(false);
    }
  };

  const createSequence = async () => {
    if (!state.generatedSequence) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectSlug}/sequences/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sequenceType: state.sequenceType,
          tone: state.tone,
          numberOfSteps: state.numberOfSteps,
          companyContext: {
            name: state.companyName,
            description: state.companyDescription,
            products: state.products.length > 0 ? state.products : undefined,
            valuePropositions: state.valuePropositions.length > 0 ? state.valuePropositions : undefined,
          },
          targetAudience: {
            description: state.targetAudienceDescription,
            painPoints: state.painPoints.length > 0 ? state.painPoints : undefined,
          },
          campaignGoals: {
            primaryCta: state.primaryCta,
            keyMessages: state.keyMessages.length > 0 ? state.keyMessages : undefined,
          },
          organizationId,
          preview: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create sequence');
      }

      const data = await response.json();
      onComplete({ id: data.sequence.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sequence');
    } finally {
      setIsCreating(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 2) {
      // Generate sequence before showing preview
      await generateSequence();
      if (!error) {
        setCurrentStep(3);
      }
    } else if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    } else {
      onCancel();
    }
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <nav aria-label="Progress" className="px-4">
        <ol className="flex items-center">
          {STEPS.map((step, index) => (
            <li
              key={step.id}
              className={cn(
                'relative flex-1',
                index !== STEPS.length - 1 && 'pr-8 sm:pr-20'
              )}
            >
              <div className="flex items-center">
                <div
                  className={cn(
                    'relative flex h-8 w-8 items-center justify-center rounded-full',
                    index < currentStep
                      ? 'bg-primary'
                      : index === currentStep
                      ? 'border-2 border-primary bg-background'
                      : 'border-2 border-muted bg-background'
                  )}
                >
                  {index < currentStep ? (
                    <Check className="h-4 w-4 text-primary-foreground" />
                  ) : (
                    <span
                      className={cn(
                        'text-sm font-medium',
                        index === currentStep
                          ? 'text-primary'
                          : 'text-muted-foreground'
                      )}
                    >
                      {index + 1}
                    </span>
                  )}
                </div>
                {index !== STEPS.length - 1 && (
                  <div
                    className={cn(
                      'absolute top-4 left-8 -ml-px h-0.5 w-full sm:w-full',
                      index < currentStep ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </div>
              <div className="mt-2 hidden sm:block">
                <span
                  className={cn(
                    'text-sm font-medium',
                    index === currentStep
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </nav>

      {/* Step content */}
      <div className="px-4 py-6 min-h-[400px]">
        {currentStep === 0 && (
          <StepType
            sequenceType={state.sequenceType}
            tone={state.tone}
            numberOfSteps={state.numberOfSteps}
            onUpdate={updateState}
          />
        )}
        {currentStep === 1 && (
          <StepContext
            companyName={state.companyName}
            companyDescription={state.companyDescription}
            products={state.products}
            valuePropositions={state.valuePropositions}
            onUpdate={updateState}
          />
        )}
        {currentStep === 2 && (
          <StepGoals
            targetAudienceDescription={state.targetAudienceDescription}
            painPoints={state.painPoints}
            primaryCta={state.primaryCta}
            keyMessages={state.keyMessages}
            onUpdate={updateState}
          />
        )}
        {currentStep === 3 && (
          <StepPreview
            generatedSequence={state.generatedSequence}
            onUpdateSequence={(sequence) =>
              updateState({ generatedSequence: sequence })
            }
          />
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center px-4 pt-4 border-t">
        <Button variant="outline" onClick={handleBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          {currentStep === 0 ? 'Cancel' : 'Back'}
        </Button>

        {currentStep === STEPS.length - 1 ? (
          <Button
            onClick={createSequence}
            disabled={!canProceed() || isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Sequence'
            )}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={!canProceed() || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                {currentStep === 2 ? 'Generate Sequence' : 'Next'}
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
