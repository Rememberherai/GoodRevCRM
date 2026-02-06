'use client';

import { useState } from 'react';
import { Sparkles, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AISequenceWizard } from './ai-sequence-wizard';
import type { CompanyContext } from '@/lib/validators/project';

interface NewSequenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  onCreated?: (sequence: { id: string }) => void;
  initialCompanyContext?: CompanyContext;
  organizationId?: string;
  organizationContext?: {
    name: string;
    domain?: string | null;
    description?: string | null;
  };
  personId?: string;
  personContext?: {
    name: string;
    email?: string | null;
    jobTitle?: string | null;
  };
}

type DialogMode = 'select' | 'ai-wizard' | 'manual';

export function NewSequenceDialog({
  open,
  onOpenChange,
  projectSlug,
  onCreated,
  initialCompanyContext,
  organizationId,
  organizationContext,
  personId,
  personContext,
}: NewSequenceDialogProps) {
  const [mode, setMode] = useState<DialogMode>('select');
  const [isCreating, setIsCreating] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualDescription, setManualDescription] = useState('');

  const handleClose = () => {
    setMode('select');
    setManualName('');
    setManualDescription('');
    onOpenChange(false);
  };

  const handleManualCreate = async () => {
    if (!manualName.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/sequences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: manualName,
          description: manualDescription || null,
          organization_id: organizationId,
          person_id: personId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create sequence');
      }

      const sequence = await response.json();
      onCreated?.(sequence);
      handleClose();
    } catch (error) {
      console.error('Error creating sequence:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleAICreated = (sequence: { id: string }) => {
    onCreated?.(sequence);
    handleClose();
  };

  // AI Wizard mode - full screen dialog
  if (mode === 'ai-wizard') {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-[90vw] w-[1400px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Create Sequence with AI
            </DialogTitle>
            <DialogDescription>
              Provide context about your campaign and AI will generate a complete email sequence.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <AISequenceWizard
              projectSlug={projectSlug}
              onComplete={handleAICreated}
              onCancel={() => setMode('select')}
              initialCompanyContext={initialCompanyContext}
              organizationId={organizationId}
              organizationContext={organizationContext}
              personId={personId}
              personContext={personContext}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Manual creation mode
  if (mode === 'manual') {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Sequence</DialogTitle>
            <DialogDescription>
              Create a blank sequence and add steps manually.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="e.g., Cold Outreach - Q1 Campaign"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                placeholder="Brief description of this sequence..."
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setMode('select')}>
              Back
            </Button>
            <Button
              onClick={handleManualCreate}
              disabled={!manualName.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Sequence'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Selection mode - choose between AI and manual
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Sequence</DialogTitle>
          <DialogDescription>
            Choose how you want to create your email sequence.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <button
            onClick={() => setMode('ai-wizard')}
            className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex-shrink-0 p-2 bg-purple-100 rounded-lg">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium">Create with AI</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Describe your campaign and AI will generate a complete multi-step sequence with personalized emails.
              </p>
              <span className="inline-block mt-2 text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded">
                Recommended
              </span>
            </div>
          </button>

          <button
            onClick={() => setMode('manual')}
            className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex-shrink-0 p-2 bg-gray-100 rounded-lg">
              <FileText className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <h3 className="font-medium">Start from scratch</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create a blank sequence and manually add each email step.
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
