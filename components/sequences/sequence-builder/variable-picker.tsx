'use client';

import { Variable } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SEQUENCE_VARIABLES } from '@/types/sequence';

interface VariablePickerProps {
  onInsert: (variable: string) => void;
}

export function VariablePicker({ onInsert }: VariablePickerProps) {
  const personVariables = SEQUENCE_VARIABLES.filter((v) => v.entity === 'person');
  const orgVariables = SEQUENCE_VARIABLES.filter((v) => v.entity === 'organization');
  const senderVariables = SEQUENCE_VARIABLES.filter((v) => v.entity === 'user');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          <Variable className="h-4 w-4 mr-2" />
          Insert Variable
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-2">Person</h4>
            <div className="grid grid-cols-2 gap-1">
              {personVariables.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => onInsert(v.name)}
                  className="text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors"
                >
                  <div className="font-mono text-xs text-primary">
                    {`{{${v.name}}}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {v.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium text-sm mb-2">Organization</h4>
            <div className="grid grid-cols-2 gap-1">
              {orgVariables.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => onInsert(v.name)}
                  className="text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors"
                >
                  <div className="font-mono text-xs text-primary">
                    {`{{${v.name}}}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {v.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium text-sm mb-2">Sender</h4>
            <div className="grid grid-cols-2 gap-1">
              {senderVariables.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => onInsert(v.name)}
                  className="text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors"
                >
                  <div className="font-mono text-xs text-primary">
                    {`{{${v.name}}}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {v.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
