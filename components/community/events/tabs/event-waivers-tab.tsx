'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface EventWaiver {
  id: string;
  template_id: string;
  created_at: string;
  contract_templates: {
    id: string;
    name: string;
    file_name: string | null;
    description: string | null;
    category: string | null;
  } | null;
}

interface ContractTemplate {
  id: string;
  name: string;
  category: string | null;
}

interface EventWaiversTabProps {
  projectSlug: string;
  eventId: string;
}

export function EventWaiversTab({ projectSlug, eventId }: EventWaiversTabProps) {
  const [waivers, setWaivers] = useState<EventWaiver[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const waiverApi = `/api/projects/${projectSlug}/events/${eventId}/waivers`;

  const loadWaivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(waiverApi);
      const data = await res.json();
      if (res.ok) setWaivers(data.waivers ?? []);
    } catch {
      console.error('Failed to load waivers');
    } finally {
      setIsLoading(false);
    }
  }, [waiverApi]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/contracts/templates?limit=100`);
      const data = await res.json();
      if (res.ok) setTemplates(data.templates ?? []);
    } catch {
      console.error('Failed to load templates');
    }
  }, [projectSlug]);

  useEffect(() => {
    void loadWaivers();
    void loadTemplates();
  }, [loadWaivers, loadTemplates]);

  const linkedTemplateIds = new Set(waivers.map(w => w.template_id));
  const availableTemplates = templates.filter(t => !linkedTemplateIds.has(t.id));

  async function handleAdd() {
    if (!selectedTemplateId) return;
    setIsAdding(true);
    try {
      const res = await fetch(waiverApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: selectedTemplateId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      toast.success('Waiver added');
      setSelectedTemplateId('');
      void loadWaivers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add waiver');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemove(waiverId: string) {
    if (!confirm('Remove this waiver from the event?')) return;
    try {
      const res = await fetch(`${waiverApi}?waiverId=${waiverId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      toast.success('Waiver removed');
      void loadWaivers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove waiver');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Event Waivers</CardTitle>
        <CardDescription>Require participants to sign waivers before or during registration.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add waiver */}
        {availableTemplates.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a contract template..." />
              </SelectTrigger>
              <SelectContent>
                {availableTemplates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}{t.category ? ` (${t.category})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAdd} disabled={isAdding || !selectedTemplateId}>
              <Plus className="mr-1 h-3 w-3" />{isAdding ? 'Adding...' : 'Add'}
            </Button>
          </div>
        )}

        {/* Waiver list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : waivers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No waivers linked to this event.
          </p>
        ) : (
          <div className="space-y-2">
            {waivers.map(w => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{w.contract_templates?.name ?? 'Unknown template'}</p>
                  {w.contract_templates?.description && (
                    <p className="text-xs text-muted-foreground">{w.contract_templates.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {w.contract_templates?.category && (
                    <Badge variant="secondary">{w.contract_templates.category}</Badge>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemove(w.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
