'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  Play,
  Power,
  PowerOff,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Map,
  FileJson,
  Download,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkflowStore } from '@/stores/workflow-store';
import { validateWorkflow } from '@/lib/workflows/validators/validate-workflow';
import { WORKFLOW_SCHEMA_VERSION } from '@/types/workflow';
import { WorkflowImportDialog } from './dialogs/workflow-import-dialog';

interface WorkflowToolbarProps {
  projectSlug: string;
}

export function WorkflowToolbar({ projectSlug }: WorkflowToolbarProps) {
  const router = useRouter();
  const [isEditingName, setIsEditingName] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    workflowId,
    workflowName,
    workflowDescription,
    triggerType,
    triggerConfig,
    tags,
    setWorkflowName,
    isActive,
    currentVersion,
    nodes,
    edges,
    isSaving,
    setIsSaving,
    markSaved,
    hasUnsavedChanges,
    setValidationErrors,
    palettePanelOpen,
    setPalettePanelOpen,
    minimapVisible,
    setMinimapVisible,
  } = useWorkflowStore();

  async function handleSave() {
    if (!workflowId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const definition = {
        schema_version: WORKFLOW_SCHEMA_VERSION,
        nodes,
        edges,
      };

      // Validate
      const errors = validateWorkflow(definition);
      setValidationErrors(errors);

      const res = await fetch(`/api/projects/${projectSlug}/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workflowName,
          description: workflowDescription,
          trigger_type: triggerType,
          trigger_config: triggerConfig,
          tags,
          definition,
        }),
      });

      if (res.ok) {
        markSaved();
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || `Save failed (${res.status})`);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleActivate() {
    if (!workflowId) return;
    try {
      const res = await fetch(
        `/api/projects/${projectSlug}/workflows/${workflowId}/activate`,
        { method: 'POST' }
      );
      if (res.ok) {
        const data = await res.json();
        useWorkflowStore.getState().loadWorkflow(data.workflow);
      } else {
        const data = await res.json();
        if (data.validation_errors) {
          setValidationErrors(data.validation_errors);
        }
      }
    } catch (error) {
      console.error('Failed to toggle active:', error);
    }
  }

  async function handleTestRun() {
    if (!workflowId) return;
    try {
      await fetch(
        `/api/projects/${projectSlug}/workflows/${workflowId}/execute`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
      );
    } catch (error) {
      console.error('Failed to execute:', error);
    }
  }

  function handleExport() {
    const definition = {
      schema_version: WORKFLOW_SCHEMA_VERSION,
      nodes,
      edges,
    };
    const blob = new Blob([JSON.stringify(definition, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName || 'workflow'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-12 border-b bg-background flex items-center gap-2 px-3">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => router.push(`/projects/${projectSlug}/workflows`)}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      {/* Workflow name - inline editable */}
      {isEditingName ? (
        <Input
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          onBlur={() => setIsEditingName(false)}
          onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
          className="h-7 w-48 text-sm"
          autoFocus
        />
      ) : (
        <button
          onClick={() => setIsEditingName(true)}
          className="text-sm font-medium hover:bg-muted px-2 py-1 rounded truncate max-w-48"
        >
          {workflowName || 'Untitled'}
        </button>
      )}

      <Badge variant="outline" className="text-xs">
        v{currentVersion}
      </Badge>

      {hasUnsavedChanges() && (
        <Badge variant="secondary" className="text-xs">
          Unsaved
        </Badge>
      )}

      {saveError && (
        <Badge variant="destructive" className="text-xs cursor-pointer" onClick={() => setSaveError(null)}>
          {saveError}
        </Badge>
      )}

      <div className="flex-1" />

      {/* View toggles */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setPalettePanelOpen(!palettePanelOpen)}
        title={palettePanelOpen ? 'Hide palette' : 'Show palette'}
      >
        {palettePanelOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setMinimapVisible(!minimapVisible)}
        title={minimapVisible ? 'Hide minimap' : 'Show minimap'}
      >
        <Map className="h-4 w-4" />
      </Button>

      {/* Export/Import */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <FileJson className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Test Run */}
      <Button variant="outline" size="sm" className="h-8 gap-1" onClick={handleTestRun}>
        <Play className="h-3 w-3" />
        Test Run
      </Button>

      {/* Activate/Deactivate */}
      <Button
        variant={isActive ? 'destructive' : 'default'}
        size="sm"
        className="h-8 gap-1"
        onClick={handleActivate}
      >
        {isActive ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
        {isActive ? 'Deactivate' : 'Activate'}
      </Button>

      {/* Save */}
      <Button
        data-save-btn
        size="sm"
        className="h-8 gap-1"
        onClick={handleSave}
        disabled={isSaving}
      >
        <Save className="h-3 w-3" />
        {isSaving ? 'Saving...' : 'Save'}
      </Button>

      <WorkflowImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
