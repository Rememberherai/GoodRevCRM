'use client';

import { FileSignature } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DocumentsSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents Settings</h1>
        <p className="text-muted-foreground">
          Configure default options for new documents
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            Default notification preferences, signing order, reminder interval, and expiration settings will be available here in a future update.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            For now, you can configure notification and email settings on each document individually from the document detail page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
