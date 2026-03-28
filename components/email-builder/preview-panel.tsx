'use client';

import { useMemo } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEmailBuilderStore } from '@/stores/email-builder';
import { renderDesignToHtml } from '@/lib/email-builder/render-html';
import { cn } from '@/lib/utils';

export function PreviewPanel() {
  const design = useEmailBuilderStore((s) => s.design);
  const previewMode = useEmailBuilderStore((s) => s.previewMode);
  const setPreviewMode = useEmailBuilderStore((s) => s.setPreviewMode);

  const html = useMemo(() => renderDesignToHtml(design), [design]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 border-b p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 px-2', previewMode === 'desktop' && 'bg-muted')}
          onClick={() => setPreviewMode('desktop')}
        >
          <Monitor className="h-4 w-4 mr-1" />
          Desktop
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 px-2', previewMode === 'mobile' && 'bg-muted')}
          onClick={() => setPreviewMode('mobile')}
        >
          <Smartphone className="h-4 w-4 mr-1" />
          Mobile
        </Button>
      </div>
      <div className="flex-1 overflow-auto bg-muted/30 p-4">
        <div
          className="mx-auto transition-all duration-200"
          style={{
            width: previewMode === 'mobile' ? 375 : '100%',
            maxWidth: previewMode === 'mobile' ? 375 : design.globalStyles.contentWidth + 40,
          }}
        >
          <iframe
            srcDoc={html}
            title="Email preview"
            className="w-full border-0 bg-white rounded shadow-sm"
            style={{ minHeight: 500 }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}
