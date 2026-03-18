'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { AccountForm } from './account-form';
import type { Database } from '@/types/database';

type Account = Database['public']['Tables']['chart_of_accounts']['Row'];

const TYPE_COLORS: Record<string, string> = {
  asset: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  liability: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  equity: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  revenue: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  expense: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
};

interface TreeNode extends Account {
  children: TreeNode[];
  depth: number;
}

function buildTree(accounts: Account[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Create nodes
  for (const account of accounts) {
    map.set(account.id, { ...account, children: [], depth: 0 });
  }

  // Build hierarchy
  for (const account of accounts) {
    const node = map.get(account.id)!;
    if (account.parent_id && map.has(account.parent_id)) {
      const parent = map.get(account.parent_id)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const assignDepth = (node: TreeNode, depth: number) => {
    node.depth = depth;
    for (const child of node.children) {
      assignDepth(child, depth + 1);
    }
  };

  for (const root of roots) {
    assignDepth(root, 0);
  }

  return roots;
}

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  function walk(node: TreeNode) {
    result.push(node);
    for (const child of node.children) {
      walk(child);
    }
  }
  for (const root of nodes) {
    walk(root);
  }
  return result;
}

export function ChartOfAccountsTable() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(
    new Set(['asset', 'liability', 'equity', 'revenue', 'expense']),
  );

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/accounting/accounts?active=all');
      if (!response.ok) throw new Error('Failed to fetch');
      const { data } = await response.json();
      setAccounts(data);
    } catch {
      toast.error('Failed to load chart of accounts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const response = await fetch(`/api/accounting/accounts/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }
      toast.success('Account deleted');
      fetchAccounts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete');
    } finally {
      setDeleteTarget(null);
    }
  };

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const tree = buildTree(accounts);
  const flatNodes = flattenTree(tree);

  // Group by account type (use the node's own type, preserving tree order within each group)
  const grouped = new Map<string, TreeNode[]>();
  for (const node of flatNodes) {
    const type = node.account_type;
    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type)!.push(node);
  }

  const typeOrder = ['asset', 'liability', 'equity', 'revenue', 'expense'];

  if (isLoading) {
    return <div className="text-muted-foreground text-center py-12">Loading chart of accounts...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Chart of Accounts</h1>
        <Button onClick={() => { setEditingAccount(null); setIsFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="w-[100px]">Normal</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {typeOrder.map((type) => {
              const items = grouped.get(type) ?? [];
              const isExpanded = expandedTypes.has(type);

              return [
                <TableRow
                  key={`header-${type}`}
                  className="bg-muted/50 cursor-pointer hover:bg-muted"
                  onClick={() => toggleType(type)}
                >
                  <TableCell colSpan={6} className="font-semibold capitalize">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 inline mr-2" />
                    ) : (
                      <ChevronRight className="h-4 w-4 inline mr-2" />
                    )}
                    {type}s ({items.length})
                  </TableCell>
                </TableRow>,
                ...(isExpanded
                  ? items.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-mono">
                          <span style={{ paddingLeft: `${account.depth * 20}px` }}>
                            {account.account_code}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span style={{ paddingLeft: `${account.depth * 20}px` }}>
                            {account.name}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={TYPE_COLORS[account.account_type]}>
                            {account.account_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {account.normal_balance}
                        </TableCell>
                        <TableCell>
                          {account.is_active ? (
                            <Badge variant="outline">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingAccount(account);
                                setIsFormOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {!account.is_system && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setDeleteTarget(account)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  : []),
              ];
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingAccount(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit Account' : 'Add Account'}</DialogTitle>
          </DialogHeader>
          <AccountForm
            key={editingAccount?.id ?? 'new'}
            account={editingAccount}
            accounts={accounts}
            onSuccess={() => {
              setIsFormOpen(false);
              setEditingAccount(null);
              fetchAccounts();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              If this account has transactions, it will be deactivated instead of deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
