'use client';

import { useState, useEffect, useCallback } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ApiKeysSetupDialog } from './api-keys-setup-dialog';

interface MissingKey {
  key_name: string;
  label: string;
}

interface ApiKeysRequiredButtonProps {
  projectSlug: string;
}

export function ApiKeysRequiredButton({ projectSlug }: ApiKeysRequiredButtonProps) {
  const [missingKeys, setMissingKeys] = useState<MissingKey[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/key-status`);
      if (res.ok) {
        const data = await res.json();
        setMissingKeys(data.keys_required ? data.missing_keys : []);
      }
    } catch {
      // Silently ignore — non-critical UI indicator
    }
  }, [projectSlug]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Don't render anything if no keys are missing
  if (missingKeys.length === 0) return null;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-amber-500 hover:text-amber-600"
              onClick={() => setDialogOpen(true)}
            >
              <KeyRound className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive border-2 border-card" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{missingKeys.length} API key{missingKeys.length > 1 ? 's' : ''} required</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <ApiKeysSetupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        slug={projectSlug}
        missingKeys={missingKeys}
        onKeySaved={fetchStatus}
      />
    </>
  );
}
