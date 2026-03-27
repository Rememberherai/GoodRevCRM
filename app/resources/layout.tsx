import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Community Resources',
  description: 'Browse and reserve community resources',
};

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
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
