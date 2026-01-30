'use client';

import { useState } from 'react';
import { useOrganizations } from '@/hooks/use-organizations';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

interface BulkAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedOrg {
  name: string;
  website: string;
  domain: string;
}

interface ImportResult {
  success: ParsedOrg[];
  failed: Array<{ org: ParsedOrg; error: string }>;
}

function extractDomain(url: string): string {
  try {
    let fullUrl = url.trim();
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      fullUrl = 'https://' + fullUrl;
    }
    const hostname = new URL(fullUrl).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function generateNameFromDomain(domain: string): string {
  // Remove TLD and capitalize
  const parts = domain.split('.');
  if (parts.length >= 2) {
    const name = parts[parts.length - 2] ?? domain;
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return domain;
}

function parseUrls(input: string): ParsedOrg[] {
  const lines = input
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const orgs: ParsedOrg[] = [];
  const seenDomains = new Set<string>();

  for (const line of lines) {
    const domain = extractDomain(line);
    if (domain && !seenDomains.has(domain)) {
      seenDomains.add(domain);
      orgs.push({
        name: generateNameFromDomain(domain),
        website: line.startsWith('http') ? line : `https://${line}`,
        domain,
      });
    }
  }

  return orgs;
}

export function BulkAddDialog({ open, onOpenChange }: BulkAddDialogProps) {
  const { create } = useOrganizations();
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const parsedOrgs = parseUrls(input);

  const handleImport = async () => {
    if (parsedOrgs.length === 0) return;

    setIsProcessing(true);
    const success: ParsedOrg[] = [];
    const failed: Array<{ org: ParsedOrg; error: string }> = [];

    for (const org of parsedOrgs) {
      try {
        await create({
          name: org.name,
          website: org.website,
          domain: org.domain,
        });
        success.push(org);
      } catch (err) {
        failed.push({
          org,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    setResult({ success, failed });
    setIsProcessing(false);
  };

  const handleClose = () => {
    setInput('');
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bulk Add Organizations</DialogTitle>
          <DialogDescription>
            Paste URLs or domains, one per line. Organizations will be created with names derived from the domain.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="urls">URLs or Domains</Label>
                <Textarea
                  id="urls"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`acme.com
https://example.org
www.company.io`}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>

              {parsedOrgs.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {parsedOrgs.length} organization{parsedOrgs.length !== 1 ? 's' : ''} will be created
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={parsedOrgs.length === 0 || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  `Create ${parsedOrgs.length} Organization${parsedOrgs.length !== 1 ? 's' : ''}`
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">{result.success.length} created</span>
                </div>
                {result.failed.length > 0 && (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">{result.failed.length} failed</span>
                  </div>
                )}
              </div>

              {result.failed.length > 0 && (
                <div className="space-y-2">
                  <Label>Errors</Label>
                  <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
                    {result.failed.map((f, i) => (
                      <div key={i} className="text-muted-foreground">
                        {f.org.domain}: {f.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
