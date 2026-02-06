'use client';

import { useState } from 'react';
import { X, Trash2, UserPlus, Tag, CheckCircle, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import type { BulkEntityType, BulkOperation } from '@/types/bulk';

interface BulkActionsBarProps {
  selectedCount: number;
  entityType: BulkEntityType;
  onClearSelection: () => void;
  onBulkAction: (operation: BulkOperation, data?: Record<string, unknown>) => Promise<void>;
  loading?: boolean;
  showComplete?: boolean;
  showRestore?: boolean;
  showEnrich?: boolean;
  onEnrich?: () => void;
  showResearch?: boolean;
  onResearch?: () => void;
}

export function BulkActionsBar({
  selectedCount,
  entityType,
  onClearSelection,
  onBulkAction,
  loading = false,
  showComplete = false,
  showRestore = false,
  showEnrich = false,
  onEnrich,
  showResearch = false,
  onResearch,
}: BulkActionsBarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  const handleAction = async (operation: BulkOperation, data?: Record<string, unknown>) => {
    setActionInProgress(true);
    try {
      await onBulkAction(operation, data);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDelete = async () => {
    await handleAction('delete');
    setDeleteDialogOpen(false);
  };

  const entityLabel = entityType === 'person' ? 'people' : `${entityType}s`;

  return (
    <>
      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
        <span className="text-sm font-medium px-2">
          {selectedCount} {selectedCount === 1 ? entityType : entityLabel} selected
        </span>

        <div className="flex items-center gap-1">
          {showEnrich && onEnrich && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEnrich}
              disabled={loading || actionInProgress}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Enrich
            </Button>
          )}

          {showResearch && onResearch && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResearch}
              disabled={loading || actionInProgress}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              AI Research
            </Button>
          )}

          {showComplete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction('complete')}
              disabled={loading || actionInProgress}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Complete
            </Button>
          )}

          {showRestore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction('restore')}
              disabled={loading || actionInProgress}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Restore
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={loading || actionInProgress}>
                <UserPlus className="h-4 w-4 mr-1" />
                Assign
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleAction('assign')}>
                Assign to me
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction('unassign')}>
                Unassign
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAction('add_tags')}
            disabled={loading || actionInProgress}
          >
            <Tag className="h-4 w-4 mr-1" />
            Tag
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={loading || actionInProgress}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="ml-auto"
          disabled={loading || actionInProgress}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} {entityLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move {selectedCount} {entityLabel} to the trash. You can restore them later
              from the trash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
