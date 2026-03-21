'use client';

import { Menu } from 'lucide-react';
import { useMobileSidebar } from '@/stores/mobile-sidebar';
import { Button } from '@/components/ui/button';

export function MobileMenuButton() {
  const toggle = useMobileSidebar((s) => s.toggle);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden"
      onClick={toggle}
      aria-label="Toggle navigation menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}
