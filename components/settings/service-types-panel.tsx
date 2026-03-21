'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Wrench, ArrowUp, ArrowDown } from 'lucide-react';
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
import { toast } from 'sonner';
import { useServiceTypes } from '@/hooks/use-service-types';
import {
  SERVICE_TYPE_COLORS,
  SERVICE_TYPE_COLOR_MAP,
  DEFAULT_SERVICE_TYPES,
  type ServiceTypeColor,
  type ServiceTypeRow,
} from '@/types/service-type';
import type { ProjectRole } from '@/types/user';

interface ServiceTypesPanelProps {
  currentUserRole: ProjectRole;
}

interface ServiceTypeFormData {
  name: string;
  color: ServiceTypeColor;
  is_active: boolean;
}

const emptyForm: ServiceTypeFormData = {
  name: '',
  color: 'gray',
  is_active: true,
};

function ServiceTypeBadge({ name, color }: { name: string; color: string }) {
  const colors = SERVICE_TYPE_COLOR_MAP[color as ServiceTypeColor] ?? SERVICE_TYPE_COLOR_MAP.gray;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
      {name}
    </span>
  );
}

function ColorPicker({ value, onChange }: { value: ServiceTypeColor; onChange: (c: ServiceTypeColor) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SERVICE_TYPE_COLORS.map((color) => {
        const colors = SERVICE_TYPE_COLOR_MAP[color];
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

export function ServiceTypesPanel({ currentUserRole }: ServiceTypesPanelProps) {
  const {
    serviceTypes,
    isLoading,
    create,
    update,
    remove,
    reorder,
  } = useServiceTypes();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServiceType, setEditingServiceType] = useState<ServiceTypeRow | null>(null);
  const [formData, setFormData] = useState<ServiceTypeFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ServiceTypeRow | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const canManage = currentUserRole !== 'viewer';

  const openCreateDialog = () => {
    if (!canManage) return;
    setEditingServiceType(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (st: ServiceTypeRow) => {
    if (!canManage) return;
    setEditingServiceType(st);
    setFormData({
      name: st.name,
      color: (st.color as ServiceTypeColor) || 'gray',
      is_active: st.is_active,
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
      if (editingServiceType) {
        await update(editingServiceType.id, {
          name: formData.name.trim(),
          color: formData.color,
          is_active: formData.is_active,
        });
        toast.success('Service type updated');
      } else {
        await create({
          name: formData.name.trim(),
          color: formData.color,
          is_active: formData.is_active,
          sort_order: serviceTypes.length,
        });
        toast.success('Service type created');
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
      toast.success('Service type deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete service type');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= serviceTypes.length) return;

    const current = serviceTypes[index]!;
    const swap = serviceTypes[swapIndex]!;
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
      for (let i = 0; i < DEFAULT_SERVICE_TYPES.length; i++) {
        const st = DEFAULT_SERVICE_TYPES[i]!;
        await create({
          name: st.name,
          color: st.color,
          is_active: true,
          sort_order: i,
        });
      }
      toast.success('Default service types created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to seed defaults');
    } finally {
      setIsSeeding(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Types</CardTitle>
        <CardDescription>
          Configure the service categories available for jobs, contractors, and referrals. These provide a shared vocabulary across your project.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {serviceTypes.length} service type{serviceTypes.length !== 1 ? 's' : ''}
            </p>
            <Button onClick={openCreateDialog} disabled={!canManage} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Service Type
            </Button>
          </div>

          {serviceTypes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No service types configured</p>
              <p className="text-sm mb-4">Add service types to categorize jobs, contractor specialties, and referrals.</p>
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
                  <TableHead>Active</TableHead>
                  {canManage && <TableHead className="w-[80px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceTypes.map((st, index) => (
                  <TableRow key={st.id} className={!st.is_active ? 'opacity-50' : undefined}>
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
                            disabled={index === serviceTypes.length - 1}
                            onClick={() => handleMove(index, 'down')}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{st.name}</TableCell>
                    <TableCell>
                      <ServiceTypeBadge name={st.name} color={st.color} />
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs ${st.is_active ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {st.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(st)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(st)}>
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
                {editingServiceType ? 'Edit Service Type' : 'Add Service Type'}
              </DialogTitle>
              <DialogDescription>
                {editingServiceType
                  ? 'Update this service type.'
                  : 'Add a new service type for jobs, contractors, and referrals.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="service-type-name">Name *</Label>
                <Input
                  id="service-type-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Plumbing"
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
                    <ServiceTypeBadge name={formData.name || 'Preview'} color={formData.color} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="service-type-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="service-type-active">
                  Active (available for selection in forms)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingServiceType ? 'Save Changes' : 'Add Service Type'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Service Type</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? Any jobs, contractor scopes, or referrals using this service type will have it removed.
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
      </CardContent>
    </Card>
  );
}
