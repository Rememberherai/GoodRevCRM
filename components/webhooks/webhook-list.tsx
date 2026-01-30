'use client';

import { useState } from 'react';
import { MoreHorizontal, Pencil, Trash2, Play, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { formatDistanceToNow } from 'date-fns';
import type { WebhookWithStats } from '@/types/webhook';

interface WebhookListProps {
  webhooks: WebhookWithStats[];
  onEdit: (webhook: WebhookWithStats) => void;
  onDelete: (webhookId: string) => Promise<void>;
  onToggle: (webhookId: string, isActive: boolean) => Promise<void>;
  onTest: (webhookId: string) => void;
  loading?: boolean;
}

export function WebhookList({
  webhooks,
  onEdit,
  onDelete,
  onToggle,
  onTest,
  loading = false,
}: WebhookListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [webhookToDelete, setWebhookToDelete] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const handleDelete = async () => {
    if (!webhookToDelete) return;

    setActionInProgress(true);
    try {
      await onDelete(webhookToDelete);
    } finally {
      setActionInProgress(false);
      setDeleteDialogOpen(false);
      setWebhookToDelete(null);
    }
  };

  const handleToggle = async (webhookId: string, isActive: boolean) => {
    setActionInProgress(true);
    try {
      await onToggle(webhookId, !isActive);
    } finally {
      setActionInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (webhooks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No webhooks configured. Create one to start receiving notifications.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>URL</TableHead>
            <TableHead>Events</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Deliveries</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {webhooks.map((webhook) => (
            <TableRow key={webhook.id}>
              <TableCell className="font-medium">{webhook.name}</TableCell>
              <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                {webhook.url}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {webhook.events.slice(0, 2).map((event) => (
                    <Badge key={event} variant="secondary" className="text-xs">
                      {event}
                    </Badge>
                  ))}
                  {webhook.events.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{webhook.events.length - 2}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                  {webhook.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">{webhook.successful_deliveries}</span>
                  <span>/</span>
                  <span className="text-red-600">{webhook.failed_deliveries}</span>
                </div>
                {webhook.last_delivery_at && (
                  <div className="text-xs text-muted-foreground">
                    Last: {formatDistanceToNow(new Date(webhook.last_delivery_at), { addSuffix: true })}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actionInProgress}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onTest(webhook.id)}>
                      <Play className="h-4 w-4 mr-2" />
                      Test
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(webhook)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggle(webhook.id, webhook.is_active)}>
                      {webhook.is_active ? (
                        <>
                          <PowerOff className="h-4 w-4 mr-2" />
                          Disable
                        </>
                      ) : (
                        <>
                          <Power className="h-4 w-4 mr-2" />
                          Enable
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setWebhookToDelete(webhook.id);
                        setDeleteDialogOpen(true);
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this webhook? This action cannot be undone
              and all delivery history will be lost.
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
