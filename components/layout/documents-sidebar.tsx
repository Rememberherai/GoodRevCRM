'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  FileStack,
  Settings,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/stores/chat';

const navItems = [
  {
    title: 'All Documents',
    href: '',
    icon: FileText,
    disabled: false,
  },
  {
    title: 'Templates',
    href: '/templates',
    icon: FileStack,
    disabled: false,
  },
];

const bottomNavItems = [
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    disabled: false,
  },
];

interface DocumentsSidebarProps {
  className?: string;
}

export function DocumentsSidebar({ className }: DocumentsSidebarProps) {
  const pathname = usePathname();
  const basePath = '/documents';
  const toggleChat = useChatStore((s) => s.toggle);
  const chatOpen = useChatStore((s) => s.isOpen);

  return (
    <aside className={cn("w-64 border-r bg-card hidden md:flex flex-col", className)}>
      {/* Module Title */}
      <div className="p-4 border-b">
        <p className="text-sm text-muted-foreground">Documents</p>
        <h2 className="font-semibold truncate mt-1">
          Signing &amp; Management
        </h2>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navItems.map((item) => {
          const href = `${basePath}${item.href}`;
          const isActive = item.href === ''
            ? pathname === basePath
            : pathname.startsWith(href);

          if (item.disabled) {
            return (
              <div
                key={item.title}
                aria-disabled="true"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground/60 cursor-not-allowed"
                title="Coming soon"
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </div>
            );
          }

          return (
            <Link
              key={item.title}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="p-2 border-t space-y-1">
        <button
          onClick={toggleChat}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full',
            chatOpen
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
        >
          <MessageSquare className="h-4 w-4" />
          AI Agent
        </button>
        {bottomNavItems.map((item) => {
          const href = `${basePath}${item.href}`;
          const isActive = pathname.startsWith(href);

          if (item.disabled) {
            return (
              <div
                key={item.title}
                aria-disabled="true"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground/60 cursor-not-allowed"
                title="Coming soon"
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </div>
            );
          }

          return (
            <Link
              key={item.title}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
