'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DISPOSITION_COLOR_MAP, type DispositionColor, type DispositionRow } from '@/types/disposition';
import { toast } from 'sonner';

interface DispositionCellProps {
  dispositionId: string | null;
  dispositions: DispositionRow[];
  onUpdate: (newDispositionId: string | null) => Promise<void>;
}

export function DispositionCell({ dispositionId, dispositions, onUpdate }: DispositionCellProps) {
  const [updating, setUpdating] = useState(false);
  const current = dispositions.find((d) => d.id === dispositionId);

  if (dispositions.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <Select
      value={dispositionId ?? 'none'}
      onValueChange={async (v) => {
        const newId = v === 'none' ? null : v;
        if (newId === dispositionId) return;
        setUpdating(true);
        try {
          await onUpdate(newId);
        } catch {
          toast.error('Failed to update disposition');
        } finally {
          setUpdating(false);
        }
      }}
      disabled={updating}
    >
      <SelectTrigger
        className="h-7 w-auto gap-1 border-dashed text-xs px-2"
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue placeholder="Set disposition">
          {current ? (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                (DISPOSITION_COLOR_MAP[current.color as DispositionColor] ?? DISPOSITION_COLOR_MAP.gray).bg
              } ${
                (DISPOSITION_COLOR_MAP[current.color as DispositionColor] ?? DISPOSITION_COLOR_MAP.gray).text
              } ${
                (DISPOSITION_COLOR_MAP[current.color as DispositionColor] ?? DISPOSITION_COLOR_MAP.gray).border
              }`}
            >
              {current.name}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No disposition</SelectItem>
        {dispositions.map((d) => {
          const colors = DISPOSITION_COLOR_MAP[d.color as DispositionColor] ?? DISPOSITION_COLOR_MAP.gray;
          return (
            <SelectItem key={d.id} value={d.id}>
              <span className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${colors.bg} ${colors.border} border`} />
                {d.name}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
