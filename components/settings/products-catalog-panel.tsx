'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, Loader2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
import { useProducts } from '@/hooks/use-products';
import { UNIT_TYPE_OPTIONS } from '@/types/product';
import type { Product } from '@/types/product';
import type { ProjectRole } from '@/types/user';

interface ProductsCatalogPanelProps {
  slug: string;
  currentUserRole: ProjectRole;
}

interface ProductFormData {
  name: string;
  description: string;
  sku: string;
  default_price: string;
  unit_type: string;
  is_active: boolean;
}

const emptyForm: ProductFormData = {
  name: '',
  description: '',
  sku: '',
  default_price: '',
  unit_type: 'unit',
  is_active: true,
};

export function ProductsCatalogPanel({ slug, currentUserRole }: ProductsCatalogPanelProps) {
  const {
    products,
    isLoading,
    search,
    activeFilter,
    setSearch,
    setActiveFilter,
    create,
    update,
    remove,
  } = useProducts();

  const [quotesEnabled, setQuotesEnabled] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const canManageProducts = currentUserRole !== 'viewer';

  // Fetch project settings to get quotes_enabled
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setQuotesEnabled(data.project?.settings?.quotes_enabled ?? false);
      }
    } finally {
      setSettingsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleToggleQuotes = async (enabled: boolean) => {
    try {
      const res = await fetch(`/api/projects/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { quotes_enabled: enabled } }),
      });
      if (!res.ok) throw new Error('Failed to update setting');
      setQuotesEnabled(enabled);
      toast.success(enabled ? 'Quotes & line items enabled' : 'Quotes & line items disabled');
    } catch {
      toast.error('Failed to update setting');
    }
  };

  const openCreateDialog = () => {
    if (!canManageProducts) return;
    setEditingProduct(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    if (!canManageProducts) return;
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description ?? '',
      sku: product.sku ?? '',
      default_price: product.default_price !== null ? String(product.default_price) : '',
      unit_type: product.unit_type ?? 'unit',
      is_active: product.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!canManageProducts) {
      toast.error('You do not have permission to manage products');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        sku: formData.sku.trim() || undefined,
        default_price: formData.default_price ? Number(formData.default_price) : undefined,
        unit_type: formData.unit_type,
        is_active: formData.is_active,
      };
      if (editingProduct) {
        await update(editingProduct.id, payload);
        toast.success('Product updated');
      } else {
        await create(payload);
        toast.success('Product created');
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!canManageProducts) {
      toast.error('You do not have permission to manage products');
      return;
    }
    try {
      await remove(deleteTarget.id);
      toast.success('Product deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quotes & Line Items</CardTitle>
          <CardDescription>
            Enable quotes with line items on opportunities. When enabled, a Quotes tab appears on each opportunity where you can build itemized quotes from your product catalog.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              id="quotes-enabled"
              checked={quotesEnabled}
              onCheckedChange={handleToggleQuotes}
              disabled={settingsLoading || !canManageProducts}
            />
            <Label htmlFor="quotes-enabled">
              {quotesEnabled ? 'Enabled' : 'Disabled'}
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Products & Services Catalog</CardTitle>
              <CardDescription>
                Manage products and services that can be added as line items on quotes.
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog} disabled={!canManageProducts}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={activeFilter === null ? 'all' : activeFilter ? 'active' : 'inactive'}
              onValueChange={(v) =>
                setActiveFilter(v === 'all' ? null : v === 'active')
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No products yet</p>
              <p className="text-sm">Add products to your catalog to use them in quotes.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Default Price</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Status</TableHead>
                  {canManageProducts && <TableHead className="w-[80px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      <div>
                        {product.name}
                        {product.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.sku || '—'}
                    </TableCell>
                    <TableCell>{formatPrice(product.default_price)}</TableCell>
                    <TableCell className="capitalize">{product.unit_type}</TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? 'default' : 'secondary'}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {canManageProducts && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(product)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(product)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? 'Update this product or service.'
                : 'Add a new product or service to your catalog.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="product-name">Name *</Label>
              <Input
                id="product-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Consulting Hours"
                disabled={!canManageProducts}
              />
            </div>
            <div>
              <Label htmlFor="product-description">Description</Label>
              <Textarea
                id="product-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                className="resize-none"
                rows={2}
                disabled={!canManageProducts}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="product-sku">SKU</Label>
                <Input
                  id="product-sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Optional"
                  disabled={!canManageProducts}
                />
              </div>
              <div>
                <Label htmlFor="product-price">Default Price</Label>
                <Input
                  id="product-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.default_price}
                  onChange={(e) => setFormData({ ...formData, default_price: e.target.value })}
                  placeholder="0.00"
                  disabled={!canManageProducts}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="product-unit">Unit Type</Label>
                <Select
                  value={formData.unit_type}
                  onValueChange={(v) => setFormData({ ...formData, unit_type: v })}
                  disabled={!canManageProducts}
                >
                  <SelectTrigger id="product-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  id="product-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                  disabled={!canManageProducts}
                />
                <Label htmlFor="product-active">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !canManageProducts}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingProduct ? 'Save Changes' : 'Add Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? Existing line items referencing this product will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
