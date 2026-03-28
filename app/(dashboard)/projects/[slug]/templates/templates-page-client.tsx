'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TemplateList } from '@/components/email-templates/template-list';
import { TemplateEditor } from '@/components/email-templates/template-editor';
import type { EmailTemplate } from '@/types/email-template';
import type { CreateTemplateInput } from '@/lib/validators/email-template';

export function TemplatesPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [projectType, setProjectType] = useState<string>('standard');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | undefined>();

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/templates`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to load templates');
      setTemplates(data.data ?? []);
      if (data.project_type) setProjectType(data.project_type);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreate = () => {
    setEditingTemplate(undefined);
    setEditorOpen(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setEditorOpen(true);
  };

  const handleDuplicate = async (template: EmailTemplate) => {
    try {
      const response = await fetch(`/api/projects/${slug}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template.name} (copy)`,
          description: template.description,
          subject: template.subject,
          body_html: template.body_html,
          body_text: template.body_text,
          design_json: template.design_json,
          category: template.category,
          variables: template.variables,
          is_active: template.is_active,
          is_shared: template.is_shared,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to duplicate template');
      }
      await loadTemplates();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to duplicate template');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${slug}/templates/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to delete template');
      }
      setDeleteTarget(null);
      await loadTemplates();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete template');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async (data: CreateTemplateInput) => {
    const isEdit = !!editingTemplate;
    const url = isEdit
      ? `/api/projects/${slug}/templates/${editingTemplate.id}`
      : `/api/projects/${slug}/templates`;
    const method = isEdit ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error ?? `Failed to ${isEdit ? 'update' : 'create'} template`);
    }

    setEditorOpen(false);
    setEditingTemplate(undefined);
    await loadTemplates();
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Email Templates
            </CardTitle>
            <CardDescription>
              Create and manage reusable email templates for broadcasts and sequences.
            </CardDescription>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
          ) : (
            <TemplateList
              templates={templates}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onDelete={(t) => setDeleteTarget(t)}
            />
          )}
        </CardContent>
      </Card>

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={(open) => {
        if (!open) {
          setEditorOpen(false);
          setEditingTemplate(undefined);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'New Template'}
            </DialogTitle>
          </DialogHeader>
          <TemplateEditor
            template={editingTemplate}
            projectType={projectType}
            onSave={handleSave}
            onCancel={() => {
              setEditorOpen(false);
              setEditingTemplate(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
