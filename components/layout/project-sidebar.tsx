'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  Users,
  Target,
  FileText,
  LayoutDashboard,
  Settings,
  Mail,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project } from '@/types/project';

interface ProjectSidebarProps {
  project: Project;
}

const navItems = [
  {
    title: 'Dashboard',
    href: '',
    icon: LayoutDashboard,
  },
  {
    title: 'Organizations',
    href: '/organizations',
    icon: Building2,
  },
  {
    title: 'People',
    href: '/people',
    icon: Users,
  },
  {
    title: 'Opportunities',
    href: '/opportunities',
    icon: Target,
  },
  {
    title: 'RFPs',
    href: '/rfps',
    icon: FileText,
  },
  {
    title: 'Sequences',
    href: '/sequences',
    icon: Mail,
  },
];

const bottomNavItems = [
  {
    title: 'Search',
    href: '/search',
    icon: Search,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function ProjectSidebar({ project }: ProjectSidebarProps) {
  const pathname = usePathname();
  const basePath = `/projects/${project.slug}`;

  return (
    <aside className="w-64 border-r bg-card flex flex-col">
      {/* Project Name */}
      <div className="p-4 border-b">
        <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground">
          ← All Projects
        </Link>
        <h2 className="mt-2 font-semibold truncate" title={project.name}>
          {project.name}
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
