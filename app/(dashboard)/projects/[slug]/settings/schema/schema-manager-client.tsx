'use client';

import { useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCustomFields } from '@/hooks/use-custom-fields';
import {
  ENTITY_TYPES,
  ENTITY_TYPE_LABELS,
  SYSTEM_FIELDS_BY_ENTITY,
  type EntityType,
} from '@/types/custom-field';
import { FieldList } from '@/components/schema/field-list';
import { AddFieldDialog } from '@/components/schema/add-field-dialog';
import { EditFieldDialog } from '@/components/schema/edit-field-dialog';
import { DeleteFieldDialog } from '@/components/schema/delete-field-dialog';
import type { CustomFieldDefinition } from '@/types/custom-field';

export function SchemaManagerClient() {
  const {
    fieldsByEntity,
    isLoading,
    selectedEntityType,
    setSelectedEntityType,
    reorder,
  } = useCustomFields();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editField, setEditField] = useState<CustomFieldDefinition | null>(null);
  const [deleteField, setDeleteField] = useState<CustomFieldDefinition | null>(null);

  const handleEntityTypeChange = (value: string) => {
    setSelectedEntityType(value as EntityType);
  };

  const handleReorder = async (reorderedFields: CustomFieldDefinition[]) => {
    const fieldOrders = reorderedFields.map((field, index) => ({
      id: field.id,
      display_order: index,
    }));
    await reorder(selectedEntityType, fieldOrders);
  };

  const systemFields = SYSTEM_FIELDS_BY_ENTITY[selectedEntityType];
  const customFields = fieldsByEntity[selectedEntityType] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schema Manager</h1>
          <p className="text-muted-foreground">
            Configure system fields and create custom fields for your entities.
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Field
        </Button>
      </div>

      <Tabs
        value={selectedEntityType}
        onValueChange={handleEntityTypeChange}
        className="space-y-4"
      >
        <TabsList>
          {ENTITY_TYPES.map((type) => (
            <TabsTrigger key={type} value={type} className="capitalize">
              {ENTITY_TYPE_LABELS[type]}
            </TabsTrigger>
          ))}
        </TabsList>

        {ENTITY_TYPES.map((type) => (
          <TabsContent key={type} value={type} className="space-y-6">
            {/* System Fields Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-medium">System Fields</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                These are built-in fields that cannot be modified or deleted.
              </p>
              <div className="rounded-lg border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-sm font-medium">Label</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                      <th className="px-4 py-3 text-center text-sm font-medium">Required</th>
                      <th className="px-4 py-3 text-center text-sm font-medium">Searchable</th>
                      <th className="px-4 py-3 text-center text-sm font-medium">Filterable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemFields.map((field) => (
                      <tr key={field.name} className="border-b last:border-0">
                        <td className="px-4 py-3 text-sm">{field.label}</td>
                        <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                          {field.name}
                        </td>
                        <td className="px-4 py-3 text-sm capitalize">
                          {field.field_type.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          {field.is_required ? '✓' : '-'}
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          {field.is_searchable ? '✓' : '-'}
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          {field.is_filterable ? '✓' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Custom Fields Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-medium">Custom Fields</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Create custom fields to capture additional data specific to your workflow.
                Drag to reorder fields.
              </p>
              <FieldList
                fields={customFields}
                isLoading={isLoading}
                onEdit={setEditField}
                onDelete={setDeleteField}
                onReorder={handleReorder}
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Dialogs */}
      <AddFieldDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        entityType={selectedEntityType}
      />

      <EditFieldDialog
        open={!!editField}
        onOpenChange={(open) => !open && setEditField(null)}
        field={editField}
      />

      <DeleteFieldDialog
        open={!!deleteField}
        onOpenChange={(open) => !open && setDeleteField(null)}
        field={deleteField}
      />
    </div>
  );
}
