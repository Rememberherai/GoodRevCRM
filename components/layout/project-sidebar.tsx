'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Award,
  Building2,
  Users,
  Target,
  FileText,
  LayoutDashboard,
  CalendarRange,
  Settings,
  Mail,
  Library,
  BarChart3,
  Newspaper,
  MessageSquare,
  GitBranch,
  PenTool,
  Home,
  HandCoins,
  HardHat,
  BriefcaseBusiness,
  Clock,
  Map,
  SendToBack,
  CalendarDays,
  Megaphone,
  Globe,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useChatStore } from '@/stores/chat';
import type { Project } from '@/types/project';
import type { ProjectRole } from '@/types/user';

interface ProjectSidebarProps {
  project: Project;
  role?: ProjectRole;
  deniedResources?: string[];
  className?: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  resource?: string;
}

const standardNavItems: NavItem[] = [
  { title: 'Dashboard', href: '', icon: LayoutDashboard },
  { title: 'Organizations', href: '/organizations', icon: Building2 },
  { title: 'People', href: '/people', icon: Users },
  { title: 'Opportunities', href: '/opportunities', icon: Target },
  { title: 'RFPs', href: '/rfps', icon: FileText },
  { title: 'Sequences', href: '/sequences', icon: Mail },
  { title: 'Content Library', href: '/content-library', icon: Library },
  { title: 'Reporting', href: '/reports', icon: BarChart3 },
  { title: 'News', href: '/news', icon: Newspaper },
  { title: 'Contracts', href: '/contracts', icon: PenTool },
  { title: 'Workflows', href: '/workflows', icon: GitBranch },
];

const grantsNavItems: NavItem[] = [
  { title: 'Dashboard', href: '', icon: LayoutDashboard, resource: 'dashboard' },
  { title: 'Grants Pipeline', href: '/grants', icon: Award, resource: 'grants' },
  { title: 'Organizations', href: '/organizations', icon: Building2 },
  { title: 'People', href: '/people', icon: Users },
  { title: 'Discover', href: '/grants/discover', icon: Search, resource: 'grants' },
  { title: 'Content Library', href: '/content-library', icon: Library },
  { title: 'Reporting', href: '/reports', icon: BarChart3, resource: 'reports' },
];

const communityNavItems: NavItem[] = [
  { title: 'Dashboard', href: '', icon: LayoutDashboard, resource: 'dashboard' },
  { title: 'Households', href: '/households', icon: Home, resource: 'households' },
  { title: 'People', href: '/people', icon: Users },
  { title: 'Organizations', href: '/organizations', icon: Building2 },
  { title: 'Programs', href: '/programs', icon: CalendarRange, resource: 'programs' },
  { title: 'Events', href: '/events', icon: CalendarDays, resource: 'events' },
  { title: 'Referrals', href: '/referrals', icon: SendToBack, resource: 'referrals' },
  { title: 'Contractors', href: '/contractors', icon: HardHat },
  { title: 'Employees', href: '/employees', icon: Users },
  { title: 'Jobs', href: '/jobs', icon: BriefcaseBusiness, resource: 'jobs' },
  { title: 'Timesheets', href: '/timesheets', icon: Clock, resource: 'jobs' },
  { title: 'Contributions', href: '/contributions', icon: HandCoins, resource: 'contributions' },
  { title: 'Grants', href: '/grants', icon: Award, resource: 'grants' },
  { title: 'Broadcasts', href: '/broadcasts', icon: Megaphone, resource: 'broadcasts' },
  { title: 'Community Assets', href: '/community-assets', icon: Building2, resource: 'community_assets' },
  { title: 'Community Map', href: '/community-map', icon: Map },
  { title: 'Public Dashboard', href: '/settings/public-dashboard', icon: Globe, resource: 'public_dashboard' },
  { title: 'Reporting', href: '/reports', icon: BarChart3, resource: 'reports' },
];

const bottomNavItems: NavItem[] = [
  { title: 'Settings', href: '/settings', icon: Settings },
];

export function ProjectSidebar({ project, role, deniedResources, className }: ProjectSidebarProps) {
  const pathname = usePathname();
  const basePath = `/projects/${project.slug}`;
  const toggleChat = useChatStore((s) => s.toggle);
  const chatOpen = useChatStore((s) => s.isOpen);

  let navItems = project.project_type === 'community'
    ? communityNavItems
    : project.project_type === 'grants'
      ? grantsNavItems
      : standardNavItems;

  if (project.project_type === 'community') {
    if (role === 'board_viewer') {
      navItems = communityNavItems.filter((item) => item.title === 'Dashboard' || item.title === 'Reporting');
    } else if (role === 'contractor') {
      navItems = [];
    } else if (role !== 'owner' && role !== 'admin') {
      navItems = communityNavItems.filter((item) => item.title !== 'Public Dashboard');
    }
  }

  // Hide nav items for denied override resources
  if (deniedResources && deniedResources.length > 0) {
    navItems = navItems.filter((item) => !item.resource || !deniedResources.includes(item.resource));
  }

  return (
    <aside className={cn("w-64 border-r bg-card hidden md:flex flex-col", className)}>
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
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
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
        {!(project.project_type === 'community' && (role === 'board_viewer' || role === 'contractor')) && bottomNavItems.map((item) => {
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
