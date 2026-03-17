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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ReportableObject } from '@/lib/reports/types';

interface ObjectPickerProps {
  objects: Record<string, ReportableObject>;
  selectedObject: string | null;
  onSelect: (objectName: string) => void;
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

export function ObjectPicker({ objects, selectedObject, onSelect }: ObjectPickerProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Choose a Data Source</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Select the primary object you want to report on. You can include fields from related objects in the next step.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Object.entries(objects).map(([key, obj]) => {
          const Icon = OBJECT_ICONS[key] ?? Activity;
          const colors = OBJECT_COLORS[key] ?? OBJECT_COLORS.activity_log;
          const isSelected = selectedObject === key;

          return (
            <Card
              key={key}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md group ${
                isSelected
                  ? 'ring-2 ring-primary border-primary shadow-md'
                  : 'hover:border-primary/30'
              }`}
              onClick={() => onSelect(key)}
            >
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colors!.bg} transition-transform duration-200 group-hover:scale-110`}
                  >
                    <Icon className={`h-5 w-5 ${colors!.text}`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm whitespace-nowrap">{obj.labelPlural}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">
                      {obj.fields.length} fields
                      {obj.relations.length > 0 && (
                        <span> &middot; {obj.relations.length} relations</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
