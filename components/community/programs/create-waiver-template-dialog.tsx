'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Upload, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { WaiverEditor } from './waiver-editor';

interface CreateWaiverTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  programId?: string;
  eventId?: string;
}

type Mode = 'write' | 'upload';

export function CreateWaiverTemplateDialog({
  open,
  onOpenChange,
  onCreated,
  programId,
  eventId,
}: CreateWaiverTemplateDialogProps) {
  const params = useParams();
  const slug = params.slug as string;

  const [mode, setMode] = useState<Mode>('write');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [includeSignatureLine, setIncludeSignatureLine] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName('');
    setDescription('');
    setHtmlContent('');
    setIncludeSignatureLine(true);
    setFile(null);
    setMode('write');
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const submitWriteMode = async () => {
    if (!programId && !eventId) {
      throw new Error('A program or event target is required');
    }

    const response = await fetch(`/api/projects/${slug}/contracts/templates/from-html`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: description || null,
        html_content: htmlContent,
        include_signature_line: includeSignatureLine,
        ...(programId ? { program_id: programId } : {}),
        ...(eventId ? { event_id: eventId } : {}),
      }),
    });

    const data = await response.json() as { error?: string };
    if (!response.ok) throw new Error(data.error ?? 'Failed to create waiver');
  };

  const submitUploadMode = async () => {
    if (!file) throw new Error('No file selected');
    if (!programId && !eventId) throw new Error('A program or event target is required');

    // 1. Upload the PDF
    const formData = new FormData();
    formData.append('file', file);
    const uploadResponse = await fetch(`/api/projects/${slug}/contracts/upload`, {
      method: 'POST',
      body: formData,
    });
    const uploadData = await uploadResponse.json() as {
      file_path?: string;
      file_name?: string;
      page_count?: number;
      error?: string;
    };
    if (!uploadResponse.ok) throw new Error(uploadData.error ?? 'Failed to upload file');

    // 2. Create template
    const templateResponse = await fetch(`/api/projects/${slug}/contracts/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: description || null,
        category: 'waiver',
        file_path: uploadData.file_path,
        file_name: uploadData.file_name,
        page_count: uploadData.page_count,
      }),
    });
    const templateData = await templateResponse.json() as { template?: { id: string }; error?: string };
    if (!templateResponse.ok) throw new Error(templateData.error ?? 'Failed to create template');

    // 3. Link to program
    if (templateData.template) {
      const linkPath = programId
        ? `/api/projects/${slug}/programs/${programId}/waivers`
        : `/api/projects/${slug}/events/${eventId}/waivers`;
      const linkResponse = await fetch(linkPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateData.template.id }),
      });
      if (!linkResponse.ok) {
        console.error('[CREATE_WAIVER] Failed to link template to target');
      }
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (mode === 'write' && !htmlContent.trim()) {
      toast.error('Waiver content is required');
      return;
    }
    if (mode === 'upload' && !file) {
      toast.error('Please select a PDF file');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'write') {
        await submitWriteMode();
      } else {
        await submitUploadMode();
      }
      toast.success('Waiver template created');
      handleClose(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create waiver');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = name.trim() && (mode === 'write' ? htmlContent.trim() : file);
  const targetLabel = eventId ? 'event' : 'program';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Waiver Template</DialogTitle>
          <DialogDescription>
            Create a new waiver that participants must sign. It will be linked to this {targetLabel} automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="waiver-name">Name</Label>
            <Input
              id="waiver-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Liability Waiver"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="waiver-description">Description (optional)</Label>
            <Textarea
              id="waiver-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this waiver"
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === 'write' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('write')}
            >
              <FileText className="mr-1 h-4 w-4" />
              Write Waiver
            </Button>
            <Button
              type="button"
              variant={mode === 'upload' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('upload')}
            >
              <Upload className="mr-1 h-4 w-4" />
              Upload PDF
            </Button>
          </div>

          {mode === 'write' && (
            <>
              <div className="space-y-2">
                <Label>Waiver Content</Label>
                <WaiverEditor value={htmlContent} onChange={setHtmlContent} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-sig"
                  checked={includeSignatureLine}
                  onCheckedChange={(checked) => setIncludeSignatureLine(checked === true)}
                />
                <Label htmlFor="include-sig" className="text-sm font-normal">
                  Include signature and date lines
                </Label>
              </div>
            </>
          )}

          {mode === 'upload' && (
            <div className="space-y-2">
              <Label>PDF File</Label>
              <div
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <>
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div className="text-sm font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} KB
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">Click to select a PDF file</div>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Waiver'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
