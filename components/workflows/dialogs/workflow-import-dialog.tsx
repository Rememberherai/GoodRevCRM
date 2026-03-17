'use client';

import { useState, useRef } from 'react';
import { Upload, FileJson, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWorkflowStore } from '@/stores/workflow-store';
import { validateWorkflow } from '@/lib/workflows/validators/validate-workflow';
import { WORKFLOW_SCHEMA_VERSION } from '@/types/workflow';
import type { WorkflowDefinition } from '@/types/workflow';

interface WorkflowImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkflowImportDialog({ open, onOpenChange }: WorkflowImportDialogProps) {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1MB file size limit
    if (file.size > 1024 * 1024) {
      setError('File too large (max 1MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setJsonText(text);
      setError(null);
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  }

  function handleImport() {
    setError(null);

    let parsed: WorkflowDefinition;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setError('Invalid JSON format');
      return;
    }

    // Basic structure check
    if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
      setError('Missing or invalid "nodes" array');
      return;
    }
    if (!parsed.edges || !Array.isArray(parsed.edges)) {
      setError('Missing or invalid "edges" array');
      return;
    }

    // Set schema version if missing
    if (!parsed.schema_version) {
      parsed.schema_version = WORKFLOW_SCHEMA_VERSION;
    }

    // Validate
    const errors = validateWorkflow(parsed);
    const blockers = errors.filter((e) => e.severity === 'error');
    if (blockers.length > 0) {
      setError(`Validation errors: ${blockers.map((e) => e.message).join('; ')}`);
      return;
    }

    // Apply to store
    const store = useWorkflowStore.getState();
    store.setNodes(parsed.nodes);
    store.setEdges(parsed.edges);
    store.setValidationErrors(errors);

    onOpenChange(false);
    setJsonText('');
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setJsonText(''); setError(null); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Import Workflow
          </DialogTitle>
          <DialogDescription>
            Import a workflow definition from a JSON file or paste JSON directly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Choose JSON File
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex items-center justify-center">
              <span className="bg-background px-2 text-xs text-muted-foreground -translate-y-1/2">
                or paste JSON
              </span>
            </div>
          </div>

          <Textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setError(null);
            }}
            placeholder='{"schema_version": "1.0.0", "nodes": [...], "edges": [...]}'
            className="font-mono text-xs min-h-[200px]"
          />

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!jsonText.trim()}>
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
