'use client';

import { Globe, Eye, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function PublishControls({
  status,
  disabled,
  onStatusChange,
}: {
  status: 'draft' | 'preview' | 'published' | 'archived';
  disabled?: boolean;
  onStatusChange: (status: 'draft' | 'preview' | 'published' | 'archived') => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Publish Controls</CardTitle>
        <CardDescription>Preview, publish, or archive the current public dashboard.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button disabled={disabled || status === 'draft'} variant={status === 'draft' ? 'default' : 'outline'} onClick={() => onStatusChange('draft')}>
          Draft
        </Button>
        <Button disabled={disabled || status === 'preview'} variant={status === 'preview' ? 'default' : 'outline'} onClick={() => onStatusChange('preview')}>
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </Button>
        <Button disabled={disabled || status === 'published'} variant={status === 'published' ? 'default' : 'outline'} onClick={() => onStatusChange('published')}>
          <Globe className="mr-2 h-4 w-4" />
          Publish
        </Button>
        <Button disabled={disabled || status === 'archived'} variant={status === 'archived' ? 'default' : 'outline'} onClick={() => onStatusChange('archived')}>
          <Archive className="mr-2 h-4 w-4" />
          Archive
        </Button>
      </CardContent>
    </Card>
  );
}
