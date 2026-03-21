'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  Clock,
  CalendarCheck,
  Users,
  Link as LinkIcon,
  Settings,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/stores/chat';

const navItems = [
  {
    title: 'Calendar',
    href: '',
    icon: CalendarDays,
    disabled: false,
  },
  {
    title: 'Event Types',
    href: '/event-types',
    icon: Clock,
    disabled: false,
  },
  {
    title: 'Availability',
    href: '/availability',
    icon: CalendarCheck,
    disabled: false,
  },
  {
    title: 'Bookings',
    href: '/bookings',
    icon: Users,
    disabled: false,
  },
  {
    title: 'Integrations',
    href: '/integrations',
    icon: LinkIcon,
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

interface CalendarSidebarProps {
  profileSlug: string;
  className?: string;
}

export function CalendarSidebar({ profileSlug, className }: CalendarSidebarProps) {
  const pathname = usePathname();
  const basePath = '/calendar';
  const toggleChat = useChatStore((s) => s.toggle);
  const chatOpen = useChatStore((s) => s.isOpen);

  return (
    <aside className={cn("w-64 border-r bg-card hidden md:flex flex-col", className)}>
      {/* Booking link */}
      <div className="p-4 border-b">
        <p className="text-sm text-muted-foreground">Calendar</p>
        <p className="text-xs text-muted-foreground mt-1 truncate">
          /book/{profileSlug}
        </p>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-2 space-y-1">
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
          Chat
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
