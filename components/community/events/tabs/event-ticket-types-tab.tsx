'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface TicketType {
  id: string;
  name: string;
  description: string | null;
  quantity_available: number | null;
  max_per_order: number;
  is_active: boolean;
  sort_order: number;
}

interface EventTicketTypesTabProps {
  projectSlug: string;
  eventId: string;
  ticketTypes: TicketType[];
  onUpdated: () => void;
}

interface TicketForm {
  name: string;
  description: string;
  quantity_available: string;
  max_per_order: string;
  is_active: boolean;
}

const emptyForm: TicketForm = { name: '', description: '', quantity_available: '', max_per_order: '10', is_active: true };

export function EventTicketTypesTab({ projectSlug, eventId, ticketTypes, onUpdated }: EventTicketTypesTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TicketForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const apiBase = `/api/projects/${projectSlug}/events/${eventId}/ticket-types`;

  function startEdit(tt: TicketType) {
    setEditingId(tt.id);
    setShowAddForm(false);
    setForm({
      name: tt.name,
      description: tt.description || '',
      quantity_available: tt.quantity_available != null ? String(tt.quantity_available) : '',
      max_per_order: String(tt.max_per_order),
      is_active: tt.is_active,
    });
  }

  function cancelForm() {
    setShowAddForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit() {
    if (!form.name.trim()) return;
    setIsSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        quantity_available: form.quantity_available ? parseInt(form.quantity_available, 10) : null,
        max_per_order: parseInt(form.max_per_order, 10) || 10,
        is_active: form.is_active,
      };

      const url = editingId ? `${apiBase}/${editingId}` : apiBase;
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }

      toast.success(editingId ? 'Ticket type updated' : 'Ticket type created');
      cancelForm();
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(tid: string) {
    if (!confirm('Delete this ticket type?')) return;
    try {
      const res = await fetch(`${apiBase}/${tid}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      toast.success('Ticket type deleted');
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  function renderForm() {
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Quantity Available</Label>
            <Input type="number" min="1" value={form.quantity_available} onChange={e => setForm(f => ({ ...f, quantity_available: e.target.value }))} placeholder="Unlimited" />
          </div>
          <div className="space-y-1">
            <Label>Max Per Order</Label>
            <Input type="number" min="1" max="100" value={form.max_per_order} onChange={e => setForm(f => ({ ...f, max_per_order: e.target.value }))} />
          </div>
          <div className="flex items-end gap-2 pb-0.5">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Active</Label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={cancelForm}><X className="mr-1 h-3 w-3" />Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSaving || !form.name.trim()}>
            {isSaving ? 'Saving...' : editingId ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Ticket Types</CardTitle>
          <CardDescription>Manage ticket tiers for this event.</CardDescription>
        </div>
        {!showAddForm && !editingId && (
          <Button size="sm" onClick={() => { setShowAddForm(true); setForm(emptyForm); }}>
            <Plus className="mr-1 h-3 w-3" />Add Ticket Type
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {showAddForm && renderForm()}

        {ticketTypes.length === 0 && !showAddForm ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No ticket types configured. A default &ldquo;General Admission&rdquo; ticket will be used.
          </p>
        ) : (
          ticketTypes.map(tt => (
            editingId === tt.id ? (
              <div key={tt.id}>{renderForm()}</div>
            ) : (
              <div key={tt.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{tt.name}</p>
                  {tt.description && <p className="text-xs text-muted-foreground">{tt.description}</p>}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span>Limit: {tt.quantity_available ?? 'Unlimited'}</span>
                  <span>Max/order: {tt.max_per_order}</span>
                  <Badge variant={tt.is_active ? 'default' : 'secondary'}>{tt.is_active ? 'Active' : 'Inactive'}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(tt)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(tt.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )
          ))
        )}
      </CardContent>
    </Card>
  );
}
