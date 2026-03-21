'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Bug,
  Activity,
  Settings,
  ArrowLeft,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { title: 'Users', href: '/admin/users', icon: Users },
  { title: 'Projects', href: '/admin/projects', icon: FolderKanban },
  { title: 'Bug Reports', href: '/admin/bug-reports', icon: Bug },
  { title: 'Activity Log', href: '/admin/activity', icon: Activity },
  { title: 'Settings', href: '/admin/settings', icon: Settings },
];

interface AdminSidebarProps {
  adminName: string;
  adminEmail: string;
  className?: string;
}

export function AdminSidebar({ adminName, adminEmail, className }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={cn("w-64 border-r bg-card hidden md:flex flex-col", className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-500" />
          <span className="font-semibold text-sm">Admin Panel</span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.title}
              href={item.href}
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

      {/* Bottom */}
      <div className="p-2 border-t space-y-1">
        <Link
          href="/projects"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to CRM
        </Link>
        <div className="px-3 py-2">
          <p className="text-sm font-medium truncate">{adminName}</p>
          <p className="text-xs text-muted-foreground truncate">{adminEmail}</p>
        </div>
      </div>
    </aside>
  );
}
