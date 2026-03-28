'use client';

import { DocumentsSidebar } from '@/components/layout/documents-sidebar';
import { DocumentsHeader } from '@/components/layout/documents-header';
import { MobileSidebar } from '@/components/layout/mobile-sidebar';

interface DocumentsShellProps {
  children: React.ReactNode;
}

export function DocumentsShell({ children }: DocumentsShellProps) {
  return (
    <div className="flex h-screen bg-background">
      <DocumentsSidebar />
      <MobileSidebar>
        <DocumentsSidebar className="flex w-full border-r-0" />
      </MobileSidebar>
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <DocumentsHeader />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
