'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ChevronDown, LayoutGrid, Calculator } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const modules = [
  {
    id: 'crm' as const,
    label: 'CRM',
    icon: LayoutGrid,
    href: '/projects',
    matchPrefix: '/projects',
  },
  {
    id: 'accounting' as const,
    label: 'Accounting',
    icon: Calculator,
    href: '/accounting',
    matchPrefix: '/accounting',
  },
];

export function ModuleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();

  const activeModule = modules.find((m) => pathname.startsWith(m.matchPrefix)) ?? modules[0];
  const ActiveIcon = activeModule?.icon ?? LayoutGrid;
  const activeLabel = activeModule?.label ?? 'CRM';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 font-semibold text-lg px-2">
          <ActiveIcon className="h-5 w-5" />
          GoodRev <span className="text-muted-foreground font-normal">{activeLabel}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {modules.map((mod) => (
          <DropdownMenuItem
            key={mod.id}
            onClick={() => router.push(mod.href)}
            className="gap-2"
          >
            <mod.icon className="h-4 w-4" />
            {mod.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
