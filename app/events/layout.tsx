import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Browse and register for upcoming events',
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
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
