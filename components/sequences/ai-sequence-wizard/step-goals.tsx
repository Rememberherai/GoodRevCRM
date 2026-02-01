'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface StepGoalsProps {
  targetAudienceDescription: string;
  painPoints: string[];
  primaryCta: string;
  keyMessages: string[];
  onUpdate: (updates: Partial<{
    targetAudienceDescription: string;
    painPoints: string[];
    primaryCta: string;
    keyMessages: string[];
  }>) => void;
}

const CTA_EXAMPLES = [
  'Schedule a demo',
  'Book a call',
  'Start free trial',
  'Reply to this email',
  'Download our guide',
  'Visit our website',
];

export function StepGoals({
  targetAudienceDescription,
  painPoints,
  primaryCta,
  keyMessages,
  onUpdate,
}: StepGoalsProps) {
  const [newPainPoint, setNewPainPoint] = useState('');
  const [newKeyMessage, setNewKeyMessage] = useState('');

  const addPainPoint = () => {
    if (newPainPoint.trim()) {
      onUpdate({ painPoints: [...painPoints, newPainPoint.trim()] });
      setNewPainPoint('');
    }
  };

  const removePainPoint = (index: number) => {
    onUpdate({ painPoints: painPoints.filter((_, i) => i !== index) });
  };

  const addKeyMessage = () => {
    if (newKeyMessage.trim()) {
      onUpdate({ keyMessages: [...keyMessages, newKeyMessage.trim()] });
      setNewKeyMessage('');
    }
  };

  const removeKeyMessage = (index: number) => {
    onUpdate({ keyMessages: keyMessages.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Define your campaign goals</h3>
        <p className="text-sm text-muted-foreground">
          Who are you targeting and what do you want them to do?
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="targetAudience">Target Audience *</Label>
          <Textarea
            id="targetAudience"
            value={targetAudienceDescription}
            onChange={(e) => onUpdate({ targetAudienceDescription: e.target.value })}
            placeholder="Describe your ideal recipient. Include their role, industry, company size, and any relevant characteristics..."
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Example: "Directors and VPs of Operations at mid-size manufacturing companies (100-500 employees) in the Midwest"
          </p>
        </div>

        <div className="space-y-2">
          <Label>Pain Points (optional)</Label>
          <p className="text-xs text-muted-foreground mb-2">
            What problems does your target audience face that you can solve?
          </p>
          <div className="flex gap-2">
            <Input
              value={newPainPoint}
              onChange={(e) => setNewPainPoint(e.target.value)}
              placeholder="e.g., Manual data entry wastes hours each week"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPainPoint();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addPainPoint}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {painPoints.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {painPoints.map((point, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {point}
                  <button
                    type="button"
                    onClick={() => removePainPoint(index)}
                    className="hover:text-foreground ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="primaryCta">Primary Call-to-Action *</Label>
          <Input
            id="primaryCta"
            value={primaryCta}
            onChange={(e) => onUpdate({ primaryCta: e.target.value })}
            placeholder="What do you want recipients to do?"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {CTA_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => onUpdate({ primaryCta: example })}
                className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Key Messages (optional)</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Specific points or information you want included in the emails.
          </p>
          <div className="flex gap-2">
            <Input
              value={newKeyMessage}
              onChange={(e) => setNewKeyMessage(e.target.value)}
              placeholder="e.g., Mention our new AI feature"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addKeyMessage();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addKeyMessage}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {keyMessages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {keyMessages.map((message, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {message}
                  <button
                    type="button"
                    onClick={() => removeKeyMessage(index)}
                    className="hover:text-foreground ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
