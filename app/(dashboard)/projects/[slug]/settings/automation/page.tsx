'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { Plus, Zap, History, Loader2, MoreHorizontal, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { AutomationForm } from '@/components/automations/automation-form';
import { AutomationExecutions } from '@/components/automations/automation-executions';
import type { Automation } from '@/types/automation';
import { triggerTypeGroups } from '@/types/automation';

interface AutomationPageProps {
  params: Promise<{ slug: string }>;
}

// Helper to get trigger label
function getTriggerLabel(triggerType: string): string {
  for (const group of Object.values(triggerTypeGroups)) {
    const trigger = group.triggers.find((t) => t.type === triggerType);
    if (trigger) return trigger.label;
  }
  return triggerType;
}

export default function AutomationPage({ params }: AutomationPageProps) {
  const { slug } = use(params);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [showExecutions, setShowExecutions] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const fetchAutomations = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/automations`);
      const data = await res.json();
      if (res.ok) {
        setAutomations(data.automations);
      }
    } catch (error) {
      console.error('Error fetching automations:', error);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/projects/${slug}/automations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      });

      if (res.ok) {
        setAutomations((prev) =>
          prev.map((a) => (a.id === id ? { ...a, is_active: isActive } : a))
        );
        toast.success(isActive ? 'Automation enabled' : 'Automation disabled');
      }
    } catch (error) {
      console.error('Error toggling automation:', error);
      toast.error('Failed to update automation');
    }
  };

  const handleCreate = async (data: Record<string, unknown>) => {
    setFormLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast.success('Automation created');
        setShowForm(false);
        fetchAutomations();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create automation');
      }
    } catch (error) {
      console.error('Error creating automation:', error);
      toast.error('Failed to create automation');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!editingAutomation) return;
    setFormLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/automations/${editingAutomation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast.success('Automation updated');
        setEditingAutomation(null);
        fetchAutomations();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update automation');
      }
    } catch (error) {
      console.error('Error updating automation:', error);
      toast.error('Failed to update automation');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/projects/${slug}/automations/${deleteId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Automation deleted');
        setAutomations((prev) => prev.filter((a) => a.id !== deleteId));
      } else {
        toast.error('Failed to delete automation');
      }
    } catch (error) {
      console.error('Error deleting automation:', error);
      toast.error('Failed to delete automation');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Automation</h2>
          <p className="text-muted-foreground">
            Create rules to automate workflows: when something happens, take action automatically.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Automation
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : automations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No automations yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Create your first automation to start automating repetitive tasks.
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Automation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {automations.map((automation) => (
            <Card key={automation.id}>
              <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Switch
                      checked={automation.is_active}
                      onCheckedChange={(checked) => handleToggle(automation.id, checked)}
                    />
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{automation.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {getTriggerLabel(automation.trigger_type)}
                        </Badge>
                        {automation.trigger_config?.entity_type && (
                          <Badge variant="secondary" className="text-xs">
                            {automation.trigger_config.entity_type}
                          </Badge>
                        )}
                        <span className="text-xs">
                          {automation.actions?.length ?? 0} action{(automation.actions?.length ?? 0) !== 1 ? 's' : ''}
                        </span>
                        {automation.execution_count > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {automation.execution_count} run{automation.execution_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowExecutions(automation.id)}
                      title="View execution history"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingAutomation(automation)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowExecutions(automation.id)}>
                          <History className="mr-2 h-4 w-4" />
                          Execution History
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(automation.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={showForm || !!editingAutomation}
        onOpenChange={(open) => {
          if (!open) {
            setShowForm(false);
            setEditingAutomation(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAutomation ? 'Edit Automation' : 'Create Automation'}
            </DialogTitle>
          </DialogHeader>
          <AutomationForm
            key={editingAutomation?.id ?? 'new'}
            automation={editingAutomation ?? undefined}
            onSubmit={editingAutomation ? handleUpdate : handleCreate}
            onCancel={() => {
              setShowForm(false);
              setEditingAutomation(null);
            }}
            loading={formLoading}
            slug={slug}
          />
        </DialogContent>
      </Dialog>

      {/* Execution History Dialog */}
      <Dialog
        open={!!showExecutions}
        onOpenChange={(open) => {
          if (!open) setShowExecutions(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Execution History</DialogTitle>
          </DialogHeader>
          {showExecutions && (
            <AutomationExecutions slug={slug} automationId={showExecutions} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete automation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this automation and all its execution history.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
