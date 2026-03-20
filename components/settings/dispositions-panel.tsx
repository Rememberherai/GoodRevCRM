'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Tag, Star, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useDispositions } from '@/hooks/use-dispositions';
import {
  DISPOSITION_COLORS,
  DISPOSITION_COLOR_MAP,
  DEFAULT_DISPOSITIONS,
  type DispositionColor,
  type DispositionEntityType,
  type DispositionRow,
} from '@/types/disposition';
import type { ProjectRole } from '@/types/user';

interface DispositionsPanelProps {
  currentUserRole: ProjectRole;
}

interface DispositionFormData {
  name: string;
  color: DispositionColor;
  is_default: boolean;
}

const emptyForm: DispositionFormData = {
  name: '',
  color: 'gray',
  is_default: false,
};

function DispositionBadge({ name, color }: { name: string; color: string }) {
  const colors = DISPOSITION_COLOR_MAP[color as DispositionColor] ?? DISPOSITION_COLOR_MAP.gray;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
      {name}
    </span>
  );
}

function ColorPicker({ value, onChange }: { value: DispositionColor; onChange: (c: DispositionColor) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {DISPOSITION_COLORS.map((color) => {
        const colors = DISPOSITION_COLOR_MAP[color];
        const selected = value === color;
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-all ${colors.bg} ${colors.text} ${colors.border} ${selected ? 'ring-2 ring-offset-1 ring-primary' : 'opacity-70 hover:opacity-100'}`}
          >
            {color}
          </button>
        );
      })}
    </div>
  );
}

function DispositionList({ entityType, currentUserRole }: { entityType: DispositionEntityType; currentUserRole: ProjectRole }) {
  const {
    dispositions,
    isLoading,
    create,
    update,
    remove,
    reorder,
  } = useDispositions(entityType);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDisposition, setEditingDisposition] = useState<DispositionRow | null>(null);
  const [formData, setFormData] = useState<DispositionFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DispositionRow | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const canManage = currentUserRole !== 'viewer';

  const entityLabel = entityType === 'organization' ? 'Organization' : 'People';

  const openCreateDialog = () => {
    if (!canManage) return;
    setEditingDisposition(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (d: DispositionRow) => {
    if (!canManage) return;
    setEditingDisposition(d);
    setFormData({
      name: d.name,
      color: (d.color as DispositionColor) || 'gray',
      is_default: d.is_default,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setIsSaving(true);
    try {
      if (editingDisposition) {
        await update(editingDisposition.id, {
          name: formData.name.trim(),
          color: formData.color,
          is_default: formData.is_default,
        });
        toast.success('Disposition updated');
      } else {
        await create({
          name: formData.name.trim(),
          color: formData.color,
          is_default: formData.is_default,
          sort_order: dispositions.length,
        });
        toast.success('Disposition created');
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget.id);
      toast.success('Disposition deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete disposition');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= dispositions.length) return;

    const current = dispositions[index]!;
    const swap = dispositions[swapIndex]!;
    const items = [
      { id: current.id, sort_order: swapIndex },
      { id: swap.id, sort_order: index },
    ];
    try {
      await reorder(items);
    } catch {
      toast.error('Failed to reorder');
    }
  };

  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    try {
      for (let i = 0; i < DEFAULT_DISPOSITIONS.length; i++) {
        const d = DEFAULT_DISPOSITIONS[i]!;
        await create({
          name: d.name,
          color: d.color,
          is_default: d.is_default,
          sort_order: i,
        });
      }
      toast.success(`Default ${entityLabel.toLowerCase()} dispositions created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to seed defaults');
    } finally {
      setIsSeeding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {dispositions.length} disposition{dispositions.length !== 1 ? 's' : ''}
          </p>
          <Button onClick={openCreateDialog} disabled={!canManage} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Disposition
          </Button>
        </div>

        {dispositions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No dispositions configured</p>
            <p className="text-sm mb-4">Add dispositions to categorize your {entityType === 'organization' ? 'organizations' : 'contacts'}.</p>
            {canManage && (
              <Button variant="outline" onClick={handleSeedDefaults} disabled={isSeeding}>
                {isSeeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Initialize with Defaults
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead>Name</TableHead>
                <TableHead>Preview</TableHead>
                <TableHead>Default</TableHead>
                {canManage && <TableHead className="w-[80px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dispositions.map((d, index) => (
                <TableRow key={d.id}>
                  <TableCell>
                    {canManage && (
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          disabled={index === 0}
                          onClick={() => handleMove(index, 'up')}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          disabled={index === dispositions.length - 1}
                          onClick={() => handleMove(index, 'down')}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>
                    <DispositionBadge name={d.name} color={d.color} />
                  </TableCell>
                  <TableCell>
                    {d.is_default && (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(d)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(d)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDisposition ? 'Edit Disposition' : 'Add Disposition'}
            </DialogTitle>
            <DialogDescription>
              {editingDisposition
                ? 'Update this disposition.'
                : `Add a new disposition for ${entityType === 'organization' ? 'organizations' : 'people'}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="disposition-name">Name *</Label>
              <Input
                id="disposition-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Customer"
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="mt-2">
                <ColorPicker value={formData.color} onChange={(c) => setFormData({ ...formData, color: c })} />
              </div>
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">Preview:</Label>
                <div className="mt-1">
                  <DispositionBadge name={formData.name || 'Preview'} color={formData.color} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="disposition-default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
              <Label htmlFor="disposition-default">
                Default for new {entityType === 'organization' ? 'organizations' : 'people'}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingDisposition ? 'Save Changes' : 'Add Disposition'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Disposition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? Any {entityType === 'organization' ? 'organizations' : 'people'} using this disposition will have it removed.
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

export function DispositionsPanel({ currentUserRole }: DispositionsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dispositions</CardTitle>
        <CardDescription>
          Configure status categories for organizations and people. Dispositions help you track where each record stands in your pipeline.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="organization">
          <TabsList>
            <TabsTrigger value="organization">Organizations</TabsTrigger>
            <TabsTrigger value="person">People</TabsTrigger>
          </TabsList>
          <TabsContent value="organization" className="mt-4">
            <DispositionList entityType="organization" currentUserRole={currentUserRole} />
          </TabsContent>
          <TabsContent value="person" className="mt-4">
            <DispositionList entityType="person" currentUserRole={currentUserRole} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
