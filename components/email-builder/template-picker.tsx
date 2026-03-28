'use client';

import { useState, useMemo } from 'react';
import { FileText, Sparkles, Mail, Calendar, UserPlus, LayoutTemplate } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STARTER_TEMPLATES, cloneTemplateDesign, type StarterTemplate } from '@/lib/email-builder/starter-templates';
import type { EmailDesign } from '@/types/email-builder';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  general: FileText,
  newsletter: Mail,
  announcement: Sparkles,
  event: Calendar,
  welcome: UserPlus,
};

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  general: 'General',
  newsletter: 'Newsletter',
  announcement: 'Announcement',
  event: 'Event',
  welcome: 'Welcome',
};

interface TemplatePickerProps {
  onSelect: (design: EmailDesign) => void;
}

export function TemplatePicker({ onSelect }: TemplatePickerProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const cats = new Set(STARTER_TEMPLATES.map((t) => t.category));
    return ['all', ...cats];
  }, []);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return STARTER_TEMPLATES;
    return STARTER_TEMPLATES.filter((t) => t.category === activeCategory);
  }, [activeCategory]);

  function handleSelect(template: StarterTemplate) {
    const design = cloneTemplateDesign(template);
    onSelect(design);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Start from a template</span>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <Badge
            key={cat}
            variant={activeCategory === cat ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setActiveCategory(cat)}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </Badge>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {filtered.map((template) => {
          const Icon = CATEGORY_ICONS[template.category] || FileText;
          const blockCount = template.design.blocks.length;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => handleSelect(template)}
              className={cn(
                'group flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center',
                'hover:border-primary hover:bg-accent/50 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted group-hover:bg-primary/10 transition-colors">
                <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </div>
              <span className="text-xs font-medium leading-tight">{template.name}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">
                {blockCount === 0 ? 'Empty' : `${blockCount} blocks`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
