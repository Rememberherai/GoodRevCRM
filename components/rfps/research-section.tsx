'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ResearchSource } from '@/types/rfp-research';

interface ResearchSectionProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  defaultOpen?: boolean;
  sources?: ResearchSource[];
  isEmpty?: boolean;
}

export function ResearchSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  sources = [],
  isEmpty = false,
}: ResearchSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (isEmpty) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <Button
          variant="ghost"
          className="w-full justify-start p-0 h-auto hover:bg-transparent"
          onClick={() => setIsOpen(!isOpen)}
        >
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <Icon className="h-4 w-4" />
            {title}
          </CardTitle>
        </Button>
      </CardHeader>
      {isOpen && (
        <CardContent className="pt-0">
          <div className="space-y-4">{children}</div>
          {sources.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">Sources</p>
              <div className="flex flex-wrap gap-2">
                {sources.map((source, idx) => (
                  <a
                    key={idx}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1"
                  >
                    <Badge variant="outline" className="text-xs hover:bg-muted cursor-pointer">
                      {source.domain}
                      <ExternalLink className="h-2.5 w-2.5 ml-1" />
                    </Badge>
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
