'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface AdminErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    console.error('Admin panel error:', error);
  }, [error]);

  return (
    <div className="flex flex-col flex-1">
      <div className="h-14 border-b bg-card flex items-center px-6">
        <h1 className="text-lg font-semibold">Error</h1>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              {error.message || 'An unexpected error occurred in the admin panel.'}
            </p>
            <Button onClick={reset}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
