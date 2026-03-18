'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  Receipt,
  FileText,
  Landmark,
  PieChart,
  Settings,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/stores/chat';

const navItems = [
  {
    title: 'Overview',
    href: '',
    icon: LayoutDashboard,
  },
  {
    title: 'Chart of Accounts',
    href: '/accounts',
    icon: BookOpen,
  },
  {
    title: 'Invoices',
    href: '/invoices',
    icon: Receipt,
  },
  {
    title: 'Bills',
    href: '/bills',
    icon: FileText,
  },
  {
    title: 'Journal Entries',
    href: '/journal-entries',
    icon: BookOpen,
  },
  {
    title: 'Bank Accounts',
    href: '/bank-accounts',
    icon: Landmark,
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: PieChart,
  },
];

const bottomNavItems = [
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

interface AccountingSidebarProps {
  companyName: string;
}

export function AccountingSidebar({ companyName }: AccountingSidebarProps) {
  const pathname = usePathname();
  const basePath = '/accounting';
  const toggleChat = useChatStore((s) => s.toggle);
  const chatOpen = useChatStore((s) => s.isOpen);

  return (
    <aside className="w-64 border-r bg-card flex flex-col">
      {/* Company Name */}
      <div className="p-4 border-b">
        <p className="text-sm text-muted-foreground">Accounting</p>
        <h2 className="font-semibold truncate mt-1" title={companyName}>
          {companyName}
        </h2>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const href = `${basePath}${item.href}`;
          const isActive = item.href === ''
            ? pathname === basePath
            : pathname.startsWith(href);

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
