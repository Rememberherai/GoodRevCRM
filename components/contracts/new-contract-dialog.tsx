'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface NewContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (contractId?: string) => void;
  opportunityId?: string;
}

export function NewContractDialog({ open, onOpenChange, onCreated, opportunityId }: NewContractDialogProps) {
  const params = useParams();
  const slug = params.slug as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [signingOrder, setSigningOrder] = useState<'sequential' | 'parallel'>('sequential');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.type !== 'application/pdf') {
      setError('Only PDF files are accepted');
      return;
    }
    if (selected.size > 25 * 1024 * 1024) {
      setError('File must be under 25MB');
      return;
    }
    setFile(selected);
    setError(null);
    if (!title) {
      setTitle(selected.name.replace(/\.pdf$/i, ''));
    }
  };

  const handleSubmit = async () => {
    if (!file || !title.trim()) return;
    setError(null);

    try {
      // Step 1: Upload file
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch(`/api/projects/${slug}/contracts/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error ?? 'Upload failed');
      }

      const uploadData = await uploadRes.json();
      setUploading(false);

      // Step 2: Create document
      setCreating(true);
      const createRes = await fetch(`/api/projects/${slug}/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          original_file_path: uploadData.file_path,
          original_file_name: uploadData.file_name,
          original_file_hash: uploadData.file_hash,
          page_count: uploadData.page_count,
          signing_order_type: signingOrder,
          opportunity_id: opportunityId ?? null,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error ?? 'Failed to create contract');
      }

      const created = await createRes.json();

      // Reset and close
      setTitle('');
      setDescription('');
      setFile(null);
      setSigningOrder('sequential');
      onOpenChange(false);
      onCreated(created.contract?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUploading(false);
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Contract</DialogTitle>
          <DialogDescription>
            Upload a PDF document and configure signing options.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File Upload */}
          <div>
            <Label>Document (PDF)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            {file ? (
              <div className="mt-2 flex items-center gap-3 p-3 border rounded-md bg-muted/50">
                <FileText className="h-8 w-8 text-blue-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 w-full border-2 border-dashed rounded-md p-8 text-center hover:border-primary/50 hover:bg-muted/50 transition-colors"
              >
                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Click to upload PDF</p>
                <p className="text-xs text-muted-foreground mt-1">Max 25MB</p>
              </button>
            )}
          </div>

          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contract title"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              className="mt-1"
              rows={2}
            />
          </div>

          <div>
            <Label>Signing Order</Label>
            <Select value={signingOrder} onValueChange={(v) => setSigningOrder(v as 'sequential' | 'parallel')}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential">Sequential (one at a time)</SelectItem>
                <SelectItem value="parallel">Parallel (all at once)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!file || !title.trim() || uploading || creating}
          >
            {(uploading || creating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {uploading ? 'Uploading...' : creating ? 'Creating...' : 'Create Contract'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
