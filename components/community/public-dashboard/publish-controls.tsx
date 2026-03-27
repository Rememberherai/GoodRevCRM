'use client';

import { Archive, Eye, FileEdit, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type DashboardStatus = 'draft' | 'preview' | 'published' | 'archived';

const STATUS_CONFIG: Record<DashboardStatus, {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}> = {
  draft: { label: 'Draft', variant: 'secondary' },
  preview: { label: 'Preview', variant: 'outline', className: 'border-amber-500 text-amber-700 bg-amber-50' },
  published: { label: 'Published', variant: 'outline', className: 'border-green-500 text-green-700 bg-green-50' },
  archived: { label: 'Archived', variant: 'outline', className: 'border-muted-foreground/50 text-muted-foreground' },
};

const STATUS_ACTIONS: Array<{
  status: DashboardStatus;
  icon: typeof Globe;
  label: string;
  description: string;
}> = [
  { status: 'draft', icon: FileEdit, label: 'Set to Draft', description: 'Not visible to anyone' },
  { status: 'preview', icon: Eye, label: 'Enable Preview', description: 'Visible to project admins only' },
  { status: 'published', icon: Globe, label: 'Publish', description: 'Publicly accessible' },
  { status: 'archived', icon: Archive, label: 'Archive', description: 'Hidden from public view' },
];

export function PublishControls({
  status,
  disabled,
  onStatusChange,
}: {
  status: DashboardStatus;
  disabled?: boolean;
  onStatusChange: (status: DashboardStatus) => void;
}) {
  const currentConfig = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-2">
      <Badge variant={currentConfig.variant} className={currentConfig.className}>
        {currentConfig.label}
      </Badge>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled}>
            Change Status
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {STATUS_ACTIONS.map((action) => {
            const Icon = action.icon;
            const isCurrent = action.status === status;
            return (
              <DropdownMenuItem
                key={action.status}
                disabled={isCurrent}
                onClick={() => onStatusChange(action.status)}
                className="flex items-start gap-3 py-2"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium text-sm">{action.label}</div>
                  <div className="text-xs text-muted-foreground">{action.description}</div>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
