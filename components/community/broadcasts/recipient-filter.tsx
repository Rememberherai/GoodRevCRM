'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface OptionRecord {
  id: string;
  label: string;
}

interface RecipientFilterValue {
  person_ids?: string[];
  household_ids?: string[];
  program_ids?: string[];
}

export function RecipientFilter({
  value,
  onChange,
}: {
  value: RecipientFilterValue;
  onChange: (value: RecipientFilterValue) => void;
}) {
  const params = useParams();
  const slug = params.slug as string;
  const [people, setPeople] = useState<OptionRecord[]>([]);
  const [households, setHouseholds] = useState<OptionRecord[]>([]);
  const [programs, setPrograms] = useState<OptionRecord[]>([]);

  useEffect(() => {
    const loadOptions = async () => {
      const [peopleResponse, householdsResponse, programsResponse] = await Promise.all([
        fetch(`/api/projects/${slug}/people?limit=50`),
        fetch(`/api/projects/${slug}/households?limit=50`),
        fetch(`/api/projects/${slug}/programs?limit=50`),
      ]);
      const [peopleData, householdsData, programsData] = await Promise.all([
        peopleResponse.json(),
        householdsResponse.json(),
        programsResponse.json(),
      ]);

      setPeople(((peopleData.people ?? []) as Array<{ id: string; first_name?: string | null; last_name?: string | null }>).map((person) => ({
        id: person.id,
        label: [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unnamed person',
      })));
      setHouseholds(((householdsData.households ?? []) as Array<{ id: string; name: string }>).map((household) => ({
        id: household.id,
        label: household.name,
      })));
      setPrograms(((programsData.programs ?? []) as Array<{ id: string; name: string }>).map((program) => ({
        id: program.id,
        label: program.name,
      })));
    };

    void loadOptions();
  }, [slug]);

  function toggle(key: keyof RecipientFilterValue, id: string, checked: boolean) {
    const current = value[key] ?? [];
    const next = checked ? [...current, id] : current.filter((item) => item !== id);
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        { title: 'People', key: 'person_ids' as const, options: people },
        { title: 'Households', key: 'household_ids' as const, options: households },
        { title: 'Programs', key: 'program_ids' as const, options: programs },
      ].map((group) => (
        <div key={group.title} className="rounded-lg border p-3">
          <div className="mb-3 text-sm font-medium">{group.title}</div>
          <div className="space-y-2">
            {group.options.length === 0 ? (
              <div className="text-xs text-muted-foreground">No options yet</div>
            ) : (
              group.options.map((option) => {
                const checked = (value[group.key] ?? []).includes(option.id);
                return (
                  <label key={option.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={checked} onCheckedChange={(next) => toggle(group.key, option.id, Boolean(next))} />
                    <Label className="font-normal">{option.label}</Label>
                  </label>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
