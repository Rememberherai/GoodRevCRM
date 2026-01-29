'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCustomFields } from '@/hooks/use-custom-fields';
import { ENTITY_TYPE_LABELS, type CustomFieldDefinition } from '@/types/custom-field';

interface DeleteFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: CustomFieldDefinition | null;
}

export function DeleteFieldDialog({ open, onOpenChange, field }: DeleteFieldDialogProps) {
  const { remove, isLoading } = useCustomFields();
  const [confirmText, setConfirmText] = useState('');

  const expectedText = field ? `DELETE ${field.name}` : '';
  const isConfirmed = confirmText === expectedText;

  const handleDelete = async () => {
    if (!field || !isConfirmed) return;

    try {
      await remove(field.id);
      setConfirmText('');
      onOpenChange(false);
    } catch {
      // Error is handled by the hook
    }
  };

  const handleClose = () => {
    setConfirmText('');
    onOpenChange(false);
  };

  if (!field) return null;

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Custom Field
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                You are about to permanently delete the custom field &quot;
                <strong>{field.label}</strong>&quot; from {ENTITY_TYPE_LABELS[field.entity_type]}.
              </p>

              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
                <p className="font-medium text-destructive">This action cannot be undone!</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>The field definition will be permanently removed</li>
                  <li>Any data stored in this field across all records will become inaccessible</li>
                  <li>Reports and filters using this field may break</li>
                </ul>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="confirm">
                  Type <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">DELETE {field.name}</code> to confirm:
                </Label>
                <Input
                  id="confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={`DELETE ${field.name}`}
                  className="font-mono"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete Field'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
