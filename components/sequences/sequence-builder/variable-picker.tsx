'use client';

import { Variable } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SEQUENCE_VARIABLES } from '@/types/sequence';
import type { BuilderVariable } from '@/lib/email-builder/variables';

interface VariableItem {
  name: string;
  description: string;
  entity: string;
}

interface VariablePickerProps {
  onInsert: (variable: string) => void;
  /** Override the default SEQUENCE_VARIABLES with a custom set (e.g. from getVariablesForProjectType). */
  variables?: BuilderVariable[];
}

export function VariablePicker({ onInsert, variables }: VariablePickerProps) {
  const items: VariableItem[] = variables ?? SEQUENCE_VARIABLES;

  const personVars = items.filter((v) => v.entity === 'person');
  const orgVars = items.filter((v) => v.entity === 'organization');
  const senderVars = items.filter((v) => v.entity === 'user');
  const householdVars = items.filter((v) => v.entity === 'household');
  const programVars = items.filter((v) => v.entity === 'program');

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
          <VariableGroup title="Person" variables={personVars} onInsert={onInsert} />
          <VariableGroup title="Organization" variables={orgVars} onInsert={onInsert} />
          <VariableGroup title="Sender" variables={senderVars} onInsert={onInsert} />
          {householdVars.length > 0 && (
            <VariableGroup title="Household" variables={householdVars} onInsert={onInsert} />
          )}
          {programVars.length > 0 && (
            <VariableGroup title="Program" variables={programVars} onInsert={onInsert} />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function VariableGroup({
  title,
  variables,
  onInsert,
}: {
  title: string;
  variables: VariableItem[];
  onInsert: (variable: string) => void;
}) {
  if (variables.length === 0) return null;

  return (
    <div>
      <h4 className="font-medium text-sm mb-2">{title}</h4>
      <div className="grid grid-cols-2 gap-1">
        {variables.map((v) => (
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
  );
}
