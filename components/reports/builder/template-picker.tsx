'use client';

import {
  Building2,
  Users,
  Target,
  FileText,
  Activity,
  CheckSquare,
  Mail,
  Phone,
  Calendar,
  ListChecks,
  Plus,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { REPORT_TEMPLATES, type ReportTemplate } from '@/lib/reports/report-templates';

interface TemplatePickerProps {
  onSelectTemplate: (template: ReportTemplate) => void;
  onStartFromScratch: () => void;
}

const OBJECT_ICONS: Record<string, React.ElementType> = {
  organizations: Building2,
  people: Users,
  opportunities: Target,
  rfps: FileText,
  activity_log: Activity,
  tasks: CheckSquare,
  sent_emails: Mail,
  calls: Phone,
  meetings: Calendar,
  sequence_enrollments: ListChecks,
};

const OBJECT_COLORS: Record<string, { bg: string; text: string }> = {
  organizations: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
  people: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-600 dark:text-violet-400' },
  opportunities: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400' },
  rfps: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
  activity_log: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-600 dark:text-cyan-400' },
  tasks: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' },
  sent_emails: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400' },
  calls: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-600 dark:text-teal-400' },
  meetings: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400' },
  sequence_enrollments: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400' },
};

export function TemplatePicker({ onSelectTemplate, onStartFromScratch }: TemplatePickerProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Start with a Template</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a pre-built report to get started instantly, or start from scratch.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_TEMPLATES.map((template) => {
          const Icon = OBJECT_ICONS[template.objectKey] ?? Activity;
          const colors = OBJECT_COLORS[template.objectKey] ?? OBJECT_COLORS.activity_log;

          return (
            <Card
              key={template.id}
              className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 group"
              onClick={() => onSelectTemplate(template)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colors!.bg} transition-transform duration-200 group-hover:scale-110`}
                  >
                    <Icon className={`h-5 w-5 ${colors!.text}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm leading-tight">{template.name}</h4>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {template.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {template.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Start from Scratch */}
        <Card
          className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 group border-dashed"
          onClick={onStartFromScratch}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted transition-transform duration-200 group-hover:scale-110">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-sm leading-tight">Start from Scratch</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  Build a fully custom report from any data source.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
