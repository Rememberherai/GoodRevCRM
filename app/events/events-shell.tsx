'use client';

import { usePathname } from 'next/navigation';

export function EventsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEmbed = pathname.startsWith('/events/embed');

  if (isEmbed) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {children}
      </div>
      <footer className="py-6 text-center text-xs text-muted-foreground">
        Powered by GoodRev
      </footer>
    </div>
  );
}
