'use client';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import {
  SEQUENCE_TYPE_LABELS,
  SEQUENCE_TYPE_DESCRIPTIONS,
  TONE_LABELS,
  TONE_DESCRIPTIONS,
  type SequenceType,
  type Tone,
} from '@/lib/validators/sequence';

interface StepTypeProps {
  sequenceType: SequenceType;
  tone: Tone;
  numberOfSteps: number;
  onUpdate: (updates: Partial<{ sequenceType: SequenceType; tone: Tone; numberOfSteps: number }>) => void;
}

const SEQUENCE_TYPES: SequenceType[] = [
  'cold_outreach',
  'follow_up',
  're_engagement',
  'event_invitation',
  'nurture',
  'onboarding',
];

const TONES: Tone[] = ['formal', 'professional', 'casual'];

export function StepType({
  sequenceType,
  tone,
  numberOfSteps,
  onUpdate,
}: StepTypeProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Sequence Type</h3>
          <p className="text-sm text-muted-foreground">
            What kind of email sequence are you creating?
          </p>
        </div>

        <RadioGroup
          value={sequenceType}
          onValueChange={(value) => onUpdate({ sequenceType: value as SequenceType })}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {SEQUENCE_TYPES.map((type) => (
            <div key={type}>
              <RadioGroupItem
                value={type}
                id={type}
                className="peer sr-only"
              />
              <Label
                htmlFor={type}
                className="flex flex-col items-start p-4 border rounded-lg cursor-pointer hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
              >
                <span className="font-medium">{SEQUENCE_TYPE_LABELS[type]}</span>
                <span className="text-sm text-muted-foreground mt-1">
                  {SEQUENCE_TYPE_DESCRIPTIONS[type]}
                </span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Tone</h3>
          <p className="text-sm text-muted-foreground">
            How should the emails sound?
          </p>
        </div>

        <RadioGroup
          value={tone}
          onValueChange={(value) => onUpdate({ tone: value as Tone })}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {TONES.map((t) => (
            <div key={t}>
              <RadioGroupItem
                value={t}
                id={`tone-${t}`}
                className="peer sr-only"
              />
              <Label
                htmlFor={`tone-${t}`}
                className="flex flex-col items-start p-4 border rounded-lg cursor-pointer hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
              >
                <span className="font-medium">{TONE_LABELS[t]}</span>
                <span className="text-sm text-muted-foreground mt-1">
                  {TONE_DESCRIPTIONS[t]}
                </span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Number of Emails</h3>
          <p className="text-sm text-muted-foreground">
            How many emails should be in the sequence?
          </p>
        </div>

        <div className="flex items-center gap-8">
          <Slider
            value={[numberOfSteps]}
            onValueChange={([value]) => onUpdate({ numberOfSteps: value })}
            min={2}
            max={10}
            step={1}
            className="flex-1"
          />
          <span className="text-2xl font-bold w-16 text-center">
            {numberOfSteps}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Recommended: 3-5 emails for most sequences. More emails for nurture campaigns.
        </p>
      </div>
    </div>
  );
}
