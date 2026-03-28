'use client';

import { BookOpen, CalendarCheck, Heart, Users, type LucideIcon } from 'lucide-react';
import { CountUp } from '@/hooks/use-count-up';

const METRIC_STYLES: Record<string, { icon: LucideIcon; color: string }> = {
  households: { icon: Users, color: 'teal' },
  programs: { icon: BookOpen, color: 'amber' },
  contributions: { icon: Heart, color: 'rose' },
  attendance: { icon: CalendarCheck, color: 'blue' },
};

const GRADIENT_MAP: Record<string, string> = {
  teal: 'from-teal-500/10 to-teal-500/5',
  amber: 'from-amber-500/10 to-amber-500/5',
  rose: 'from-rose-500/10 to-rose-500/5',
  blue: 'from-blue-500/10 to-blue-500/5',
};

const ICON_COLOR_MAP: Record<string, string> = {
  teal: 'text-teal-600 dark:text-teal-400',
  amber: 'text-amber-600 dark:text-amber-400',
  rose: 'text-rose-600 dark:text-rose-400',
  blue: 'text-blue-600 dark:text-blue-400',
};

function getStyle(label: string): { icon: LucideIcon; color: string } {
  const lower = label.toLowerCase();
  for (const [key, style] of Object.entries(METRIC_STYLES)) {
    if (lower.includes(key)) return style;
  }
  return { icon: Heart, color: 'teal' };
}

export function PublicMetricCard({
  metrics,
}: {
  title: string;
  metrics: Array<{ label: string; value: number }>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => {
        const { icon: Icon, color } = getStyle(metric.label);
        return (
          <div
            key={metric.label}
            className={`rounded-2xl bg-gradient-to-br ${GRADIENT_MAP[color] ?? GRADIENT_MAP.teal} p-6 md:p-8`}
          >
            <Icon className={`h-8 w-8 mb-3 ${ICON_COLOR_MAP[color] ?? ICON_COLOR_MAP.teal}`} />
            <CountUp
              end={metric.value}
              className="block text-4xl md:text-5xl font-bold tracking-tight"
            />
            <div className="text-sm font-medium text-muted-foreground mt-1 uppercase tracking-wider">
              {metric.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
