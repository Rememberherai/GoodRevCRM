'use client';

import { useState, useEffect, useCallback } from 'react';
import { Link2, ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PublicLink {
  key: string;
  label: string;
  path: string;
  description?: string;
}

interface PublicLinksButtonProps {
  projectSlug: string;
  projectType: string;
}

export function PublicLinksButton({ projectSlug, projectType }: PublicLinksButtonProps) {
  const [links, setLinks] = useState<PublicLink[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const isCommunity = projectType === 'community';

  const fetchLinks = useCallback(async () => {
    if (!isCommunity) return;
    try {
      setLoaded(false);
      const res = await fetch(`/api/projects/${projectSlug}/public-links`);
      if (res.ok) {
        const data = await res.json();
        setLinks(data.links ?? []);
      }
    } catch {
      // silently ignore
    } finally {
      setLoaded(true);
    }
  }, [projectSlug, isCommunity]);

  useEffect(() => {
    if (open) fetchLinks();
  }, [open, fetchLinks]);

  const getFullUrl = (path: string) => {
    return `${window.location.origin}${path}`;
  };

  const handleCopy = async (link: PublicLink) => {
    try {
      await navigator.clipboard.writeText(getFullUrl(link.path));
      setCopiedKey(link.key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // fallback
    }
  };

  // Only show for community projects
  if (!isCommunity) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <Link2 className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Public links</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-medium">Public Links</p>
          <p className="text-xs text-muted-foreground">Share these pages externally</p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {!loaded ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              Loading...
            </div>
          ) : links.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              No public links available
            </div>
          ) : (
            <div className="py-1">
              {links.map((link) => (
                <div
                  key={link.key}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-accent group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{link.label}</p>
                    {link.description && (
                      <p className="text-xs text-muted-foreground truncate">{link.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleCopy(link)}
                          >
                            {copiedKey === link.key ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>{copiedKey === link.key ? 'Copied!' : 'Copy link'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            asChild
                          >
                            <a
                              href={link.path}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>Open in new tab</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
