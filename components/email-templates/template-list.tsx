'use client';

import { useState } from 'react';
import { Mail, Copy, Pencil, Trash2, MoreHorizontal, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import type { EmailTemplate, EmailTemplateCategory } from '@/types/email-template';
import { categoryLabels } from '@/types/email-template';

interface TemplateListProps {
  templates: EmailTemplate[];
  onSelect?: (template: EmailTemplate) => void;
  onEdit?: (template: EmailTemplate) => void;
  onDuplicate?: (template: EmailTemplate) => void;
  onDelete?: (template: EmailTemplate) => void;
  onPreview?: (template: EmailTemplate) => void;
}

const categoryColors: Record<EmailTemplateCategory, string> = {
  outreach: 'bg-blue-100 text-blue-800',
  follow_up: 'bg-purple-100 text-purple-800',
  introduction: 'bg-green-100 text-green-800',
  proposal: 'bg-yellow-100 text-yellow-800',
  thank_you: 'bg-pink-100 text-pink-800',
  meeting: 'bg-indigo-100 text-indigo-800',
  reminder: 'bg-orange-100 text-orange-800',
  newsletter: 'bg-teal-100 text-teal-800',
  announcement: 'bg-red-100 text-red-800',
  other: 'bg-gray-100 text-gray-800',
};

export function TemplateList({
  templates,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onPreview,
}: TemplateListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {templates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No templates found</p>
        </div>
      ) : (
        templates.map((template) => (
          <div
            key={template.id}
            className={`p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${
              selectedId === template.id ? 'border-primary bg-muted/50' : ''
            }`}
            onClick={() => {
              setSelectedId(template.id);
              onSelect?.(template);
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium truncate">{template.name}</h3>
                  <Badge
                    variant="secondary"
                    className={categoryColors[template.category]}
                  >
                    {categoryLabels[template.category]}
                  </Badge>
                  {!template.is_active && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inactive
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {template.subject}
                </p>
                {template.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {template.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Used {template.usage_count} times</span>
                  {template.last_used_at && (
                    <span>
                      Last used{' '}
                      {new Date(template.last_used_at).toLocaleDateString()}
                    </span>
                  )}
                  {template.variables.length > 0 && (
                    <span>{template.variables.length} variables</span>
                  )}
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onPreview && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreview(template);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </DropdownMenuItem>
                  )}
                  {onEdit && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(template);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {onDuplicate && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate(template);
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(template);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
