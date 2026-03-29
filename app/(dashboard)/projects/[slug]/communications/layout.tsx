'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Megaphone, Mail, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Broadcasts', href: 'broadcasts', icon: Megaphone },
  { label: 'Sequences', href: 'sequences', icon: Mail },
  { label: 'Email Templates', href: 'templates', icon: FileText },
] as const;

export default function CommunicationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const slug = params.slug as string;
  const basePath = `/projects/${slug}/communications`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Communications</h2>
        <p className="text-sm text-muted-foreground">
          Manage broadcasts, email sequences, and reusable templates.
        </p>
      </div>

      <nav className="flex gap-1 border-b">
        {tabs.map((tab) => {
          const href = `${basePath}/${tab.href}`;
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={tab.href}
              href={href}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
