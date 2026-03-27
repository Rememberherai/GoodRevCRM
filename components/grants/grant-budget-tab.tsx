'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { BUDGET_CATEGORIES, BUDGET_CATEGORY_LABELS, type BudgetCategory, type BudgetLineItem } from '@/lib/validators/community/grant-budget';
import { cn } from '@/lib/utils';

interface GrantBudgetTabProps {
  grantId: string;
  projectSlug: string;
  amountRequested: number | null;
}

function formatCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

interface EditingRow {
  id: string | null; // null = new row
  category: BudgetCategory;
  description: string;
  quantity: string;
  unit_cost: string;
  notes: string;
}

export function GrantBudgetTab({ grantId, projectSlug, amountRequested }: GrantBudgetTabProps) {
  const [items, setItems] = useState<BudgetLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<EditingRow | null>(null);
  const [savingRow, setSavingRow] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/grants/${grantId}/budget`);
      if (!res.ok) throw new Error('Failed to load budget');
      const data = await res.json() as { items?: BudgetLineItem[] };
      setItems(data.items ?? []);
    } catch {
      toast.error('Failed to load budget');
    } finally {
      setLoading(false);
    }
  }, [grantId, projectSlug]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function startNew() {
    setEditingRow({ id: null, category: 'other', description: '', quantity: '1', unit_cost: '0', notes: '' });
  }

  function startEdit(item: BudgetLineItem) {
    setEditingRow({
      id: item.id,
      category: item.category as BudgetCategory,
      description: item.description,
      quantity: item.quantity.toString(),
      unit_cost: item.unit_cost.toString(),
      notes: item.notes ?? '',
    });
  }

  function cancelEdit() {
    setEditingRow(null);
  }

  async function saveRow() {
    if (!editingRow) return;
    const qty = parseFloat(editingRow.quantity) || 0;
    const cost = parseFloat(editingRow.unit_cost) || 0;
    if (!editingRow.description.trim()) {
      toast.error('Description is required');
      return;
    }
    setSavingRow(true);
    try {
      const payload = {
        category: editingRow.category,
        description: editingRow.description.trim(),
        quantity: qty,
        unit_cost: cost,
        notes: editingRow.notes.trim() || null,
      };
      const url = editingRow.id
        ? `/api/projects/${projectSlug}/grants/${grantId}/budget/${editingRow.id}`
        : `/api/projects/${projectSlug}/grants/${grantId}/budget`;
      const method = editingRow.id ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save');
      const data = await res.json() as { item?: BudgetLineItem };
      if (data.item) {
        setItems((prev) => {
          const idx = prev.findIndex((i) => i.id === data.item!.id);
          if (idx >= 0) {
            const next = [...prev]; next[idx] = data.item!; return next;
          }
          return [...prev, data.item!];
        });
      }
      setEditingRow(null);
      toast.success(editingRow.id ? 'Row updated' : 'Row added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingRow(false);
    }
  }

  async function deleteItem(item: BudgetLineItem) {
    if (!confirm(`Delete "${item.description}"?`)) return;
    try {
      const res = await fetch(`/api/projects/${projectSlug}/grants/${grantId}/budget/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success('Row deleted');
    } catch {
      toast.error('Failed to delete row');
    }
  }

  // Compute totals
  const grandTotal = items.reduce((sum, i) => sum + (i.line_total ?? 0), 0);
  const categoryTotals = BUDGET_CATEGORIES.reduce<Record<BudgetCategory, number>>((acc, cat) => {
    acc[cat] = items.filter((i) => i.category === cat).reduce((sum, i) => sum + (i.line_total ?? 0), 0);
    return acc;
  }, {} as Record<BudgetCategory, number>);
  const usedCategories = BUDGET_CATEGORIES.filter((c) => categoryTotals[c] > 0 || items.some((i) => i.category === c));

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Budget Builder</h3>
          {amountRequested != null && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Amount requested: {formatCurrency(amountRequested)}
            </p>
          )}
        </div>
        <Button size="sm" onClick={startNew} disabled={editingRow !== null}>
          <Plus className="h-4 w-4 mr-1" />
          Add Row
        </Button>
      </div>

      {items.length === 0 && editingRow === null ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <p className="font-medium">No budget rows yet</p>
          <p className="text-sm mt-1">Add line items to build your grant budget</p>
          <Button className="mt-4" onClick={startNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Row
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {usedCategories.map((category) => {
            const catItems = items.filter((i) => i.category === category);
            const showNewRowHere = editingRow?.id === null && editingRow?.category === category;
            if (catItems.length === 0 && !showNewRowHere) return null;

            return (
              <div key={category} className="space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-muted-foreground">{BUDGET_CATEGORY_LABELS[category]}</h4>
                  <span className="text-sm font-medium">{formatCurrency(categoryTotals[category])}</span>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-1/2">Description</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground w-16">Qty</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">Unit Cost</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">Total</th>
                        <th className="w-16" />
                      </tr>
                    </thead>
                    <tbody>
                      {catItems.map((item) => (
                        editingRow?.id === item.id ? (
                          <tr key={item.id} className="bg-accent/30">
                            <td className="px-2 py-1.5">
                              <Input
                                value={editingRow.description}
                                onChange={(e) => setEditingRow((r) => r ? { ...r, description: e.target.value } : r)}
                                className="h-7 text-sm"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                type="number" min="0" step="any"
                                value={editingRow.quantity}
                                onChange={(e) => setEditingRow((r) => r ? { ...r, quantity: e.target.value } : r)}
                                className="h-7 text-sm text-right w-16"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                type="number" min="0" step="any"
                                value={editingRow.unit_cost}
                                onChange={(e) => setEditingRow((r) => r ? { ...r, unit_cost: e.target.value } : r)}
                                className="h-7 text-sm text-right w-28"
                              />
                            </td>
                            <td className="px-3 py-2 text-right text-muted-foreground">
                              {formatCurrency((parseFloat(editingRow.quantity) || 0) * (parseFloat(editingRow.unit_cost) || 0))}
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveRow} disabled={savingRow}>
                                  <Check className="h-3.5 w-3.5 text-green-600" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit} disabled={savingRow}>
                                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={item.id} className="border-t">
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(item.unit_cost)}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.line_total)}</td>
                            <td className="px-2 py-1.5">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(item)} disabled={editingRow !== null}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteItem(item)} disabled={editingRow !== null}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      ))}
                      {/* New row form for this category */}
                      {editingRow?.id === null && editingRow?.category === category && (
                        <tr className="border-t bg-accent/30">
                          <td className="px-2 py-1.5">
                            <Input
                              autoFocus
                              value={editingRow.description}
                              onChange={(e) => setEditingRow((r) => r ? { ...r, description: e.target.value } : r)}
                              className="h-7 text-sm"
                              placeholder="Description"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number" min="0" step="any"
                              value={editingRow.quantity}
                              onChange={(e) => setEditingRow((r) => r ? { ...r, quantity: e.target.value } : r)}
                              className="h-7 text-sm text-right w-16"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number" min="0" step="any"
                              value={editingRow.unit_cost}
                              onChange={(e) => setEditingRow((r) => r ? { ...r, unit_cost: e.target.value } : r)}
                              className="h-7 text-sm text-right w-28"
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">
                            {formatCurrency((parseFloat(editingRow.quantity) || 0) * (parseFloat(editingRow.unit_cost) || 0))}
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveRow} disabled={savingRow}>
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit} disabled={savingRow}>
                                <X className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* New row form when category doesn't exist yet */}
          {editingRow?.id === null && !usedCategories.includes(editingRow.category) && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Select
                    value={editingRow.category}
                    onValueChange={(v) => setEditingRow((r) => r ? { ...r, category: v as BudgetCategory } : r)}
                  >
                    <SelectTrigger className="h-7 w-40 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUDGET_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{BUDGET_CATEGORY_LABELS[c]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="bg-accent/30">
                      <td className="px-2 py-1.5 w-1/2">
                        <Input
                          autoFocus
                          value={editingRow.description}
                          onChange={(e) => setEditingRow((r) => r ? { ...r, description: e.target.value } : r)}
                          className="h-7 text-sm"
                          placeholder="Description"
                        />
                      </td>
                      <td className="px-2 py-1.5 w-16">
                        <Input
                          type="number" min="0" step="any"
                          value={editingRow.quantity}
                          onChange={(e) => setEditingRow((r) => r ? { ...r, quantity: e.target.value } : r)}
                          className="h-7 text-sm text-right"
                        />
                      </td>
                      <td className="px-2 py-1.5 w-28">
                        <Input
                          type="number" min="0" step="any"
                          value={editingRow.unit_cost}
                          onChange={(e) => setEditingRow((r) => r ? { ...r, unit_cost: e.target.value } : r)}
                          className="h-7 text-sm text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground w-28">
                        {formatCurrency((parseFloat(editingRow.quantity) || 0) * (parseFloat(editingRow.unit_cost) || 0))}
                      </td>
                      <td className="px-2 py-1.5 w-16">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveRow} disabled={savingRow}>
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit} disabled={savingRow}>
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Grand total */}
          <div className={cn(
            'flex justify-between items-center pt-4 border-t font-semibold text-base',
            amountRequested != null && grandTotal > amountRequested && 'text-destructive'
          )}>
            <span>Grand Total</span>
            <div className="text-right">
              <span>{formatCurrency(grandTotal)}</span>
              {amountRequested != null && (
                <p className={cn('text-xs font-normal mt-0.5', grandTotal > amountRequested ? 'text-destructive' : 'text-muted-foreground')}>
                  {grandTotal > amountRequested
                    ? `${formatCurrency(grandTotal - amountRequested)} over requested`
                    : grandTotal < amountRequested
                    ? `${formatCurrency(amountRequested - grandTotal)} under requested`
                    : 'Matches amount requested'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
