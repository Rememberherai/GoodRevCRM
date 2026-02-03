"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Phone,
  Mail,
  MessageSquare,
  CalendarPlus,
  CalendarCheck,
} from "lucide-react";
import type { ActivityTiles } from "@/types/analytics";

const tiles = [
  {
    key: "calls" as const,
    label: "Calls",
    icon: Phone,
    bg: "bg-blue-100 dark:bg-blue-900/30",
    fg: "text-blue-600 dark:text-blue-400",
  },
  {
    key: "emails_sent" as const,
    label: "Emails Sent",
    icon: Mail,
    bg: "bg-green-100 dark:bg-green-900/30",
    fg: "text-green-600 dark:text-green-400",
  },
  {
    key: "quality_conversations" as const,
    label: "Quality Conversations",
    icon: MessageSquare,
    bg: "bg-purple-100 dark:bg-purple-900/30",
    fg: "text-purple-600 dark:text-purple-400",
  },
  {
    key: "meetings_booked" as const,
    label: "Meetings Booked",
    icon: CalendarPlus,
    bg: "bg-orange-100 dark:bg-orange-900/30",
    fg: "text-orange-600 dark:text-orange-400",
  },
  {
    key: "meetings_attended" as const,
    label: "Meetings Attended",
    icon: CalendarCheck,
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    fg: "text-emerald-600 dark:text-emerald-400",
  },
];

export function ActivityTilesRow({ data }: { data: ActivityTiles }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map(({ key, label, icon: Icon, bg, fg }) => (
        <Card key={key}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`rounded-full p-2 ${bg}`}>
              <Icon className={`h-4 w-4 ${fg}`} />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">
                {data[key].toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
