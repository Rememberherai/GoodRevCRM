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
  Library,
  BarChart3,
  Newspaper,
  MessageSquare,
  GitBranch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useChatStore } from '@/stores/chat';
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
  {
    title: 'Content Library',
    href: '/content-library',
    icon: Library,
  },
  {
    title: 'Reporting',
    href: '/reports',
    icon: BarChart3,
  },
  {
    title: 'News',
    href: '/news',
    icon: Newspaper,
  },
  {
    title: 'Workflows',
    href: '/workflows',
    icon: GitBranch,
  },
];

const bottomNavItems = [
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function ProjectSidebar({ project }: ProjectSidebarProps) {
  const pathname = usePathname();
  const basePath = `/projects/${project.slug}`;
  const toggleChat = useChatStore((s) => s.toggle);
  const chatOpen = useChatStore((s) => s.isOpen);

  return (
    <aside className="w-64 border-r bg-card flex flex-col">
      {/* Project Name */}
      <div className="p-4 border-b">
        <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground">
          ← All Projects
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={project.logo_url ?? undefined} alt={project.name} />
            <AvatarFallback className="text-xs">{project.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <h2 className="font-semibold truncate" title={project.name}>
            {project.name}
          </h2>
        </div>
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
