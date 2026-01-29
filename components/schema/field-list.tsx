'use client';

import { useState } from 'react';
import {
  GripVertical,
  Pencil,
  Trash2,
  MoreHorizontal,
  Eye,
  EyeOff,
  Search,
  Filter,
  Asterisk,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FIELD_TYPE_LABELS, type CustomFieldDefinition } from '@/types/custom-field';

interface FieldListProps {
  fields: CustomFieldDefinition[];
  isLoading: boolean;
  onEdit: (field: CustomFieldDefinition) => void;
  onDelete: (field: CustomFieldDefinition) => void;
  onReorder: (fields: CustomFieldDefinition[]) => void;
}

export function FieldList({
  fields,
  isLoading,
  onEdit,
  onDelete,
  onReorder,
}: FieldListProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && index !== draggedIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newFields = [...fields];
      const [draggedField] = newFields.splice(draggedIndex, 1);
      if (draggedField) {
        newFields.splice(dragOverIndex, 0, draggedField);
        onReorder(newFields);
      }
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">
          No custom fields defined yet. Click &quot;Add Field&quot; to create one.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="w-10 px-2 py-3"></th>
            <th className="px-4 py-3 text-left text-sm font-medium">Label</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Settings</th>
            <th className="w-10 px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <tr
              key={field.id}
              className={`border-b last:border-0 transition-colors ${
                dragOverIndex === index ? 'bg-muted' : ''
              } ${draggedIndex === index ? 'opacity-50' : ''}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDragLeave={handleDragLeave}
            >
              <td className="px-2 py-3">
                <button
                  type="button"
                  className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Drag to reorder"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{field.label}</span>
                  {field.group_name && (
                    <Badge variant="outline" className="text-xs">
                      {field.group_name}
                    </Badge>
                  )}
                </div>
                {field.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {field.description}
                  </p>
                )}
              </td>
              <td className="px-4 py-3">
                <code className="text-sm text-muted-foreground">{field.name}</code>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm">
                  {FIELD_TYPE_LABELS[field.field_type]}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  {field.is_required && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Asterisk className="h-3 w-3" />
                      Required
                    </Badge>
                  )}
                  {field.is_searchable && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Search className="h-3 w-3" />
                    </Badge>
                  )}
                  {field.is_filterable && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Filter className="h-3 w-3" />
                    </Badge>
                  )}
                  {field.is_visible_in_list ? (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Eye className="h-3 w-3" />
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs gap-1">
                      <EyeOff className="h-3 w-3" />
                    </Badge>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(field)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(field)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
