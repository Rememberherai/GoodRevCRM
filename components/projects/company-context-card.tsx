'use client';

import { useState } from 'react';
import { Building2, Pencil, Plus, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { CompanyContext } from '@/lib/validators/project';

interface CompanyContextCardProps {
  projectSlug: string;
  initialContext?: CompanyContext;
  onUpdate?: (context: CompanyContext) => void;
}

export function CompanyContextCard({
  projectSlug,
  initialContext,
  onUpdate,
}: CompanyContextCardProps) {
  const [context, setContext] = useState<CompanyContext>(initialContext || {});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState(context.name || '');
  const [formDescription, setFormDescription] = useState(context.description || '');
  const [formProducts, setFormProducts] = useState<string[]>(context.products || []);
  const [formValueProps, setFormValueProps] = useState<string[]>(context.value_propositions || []);
  const [newProduct, setNewProduct] = useState('');
  const [newValueProp, setNewValueProp] = useState('');

  const hasContent = context.name || context.description ||
    (context.products && context.products.length > 0) ||
    (context.value_propositions && context.value_propositions.length > 0);

  const openDialog = () => {
    setFormName(context.name || '');
    setFormDescription(context.description || '');
    setFormProducts(context.products || []);
    setFormValueProps(context.value_propositions || []);
    setError(null);
    setIsDialogOpen(true);
  };

  const addProduct = () => {
    if (newProduct.trim() && formProducts.length < 20) {
      setFormProducts([...formProducts, newProduct.trim()]);
      setNewProduct('');
    }
  };

  const removeProduct = (index: number) => {
    setFormProducts(formProducts.filter((_, i) => i !== index));
  };

  const addValueProp = () => {
    if (newValueProp.trim() && formValueProps.length < 10) {
      setFormValueProps([...formValueProps, newValueProp.trim()]);
      setNewValueProp('');
    }
  };

  const removeValueProp = (index: number) => {
    setFormValueProps(formValueProps.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    const newContext: CompanyContext = {
      name: formName || undefined,
      description: formDescription || undefined,
      products: formProducts.length > 0 ? formProducts : undefined,
      value_propositions: formValueProps.length > 0 ? formValueProps : undefined,
    };

    try {
      const response = await fetch(`/api/projects/${projectSlug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { company_context: newContext },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setContext(newContext);
      onUpdate?.(newContext);
      setIsDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Company Context</CardTitle>
          <Button variant="ghost" size="icon" onClick={openDialog}>
            <Pencil className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {hasContent ? (
            <div className="space-y-3">
              {context.name && (
                <div className="font-semibold text-lg">{context.name}</div>
              )}
              {context.description && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {context.description}
                </p>
              )}
              {context.products && context.products.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Products
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {context.products.slice(0, 3).map((product, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {product}
                      </Badge>
                    ))}
                    {context.products.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{context.products.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              {context.value_propositions && context.value_propositions.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Value Propositions
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {context.value_propositions.slice(0, 2).map((vp, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {vp.length > 30 ? vp.slice(0, 30) + '...' : vp}
                      </Badge>
                    ))}
                    {context.value_propositions.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{context.value_propositions.length - 2} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <Building2 className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Add your company info to help AI write better sequences
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={openDialog}>
                <Plus className="h-4 w-4 mr-1" />
                Add Context
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Company Context</DialogTitle>
            <DialogDescription>
              This information helps AI write authentic, relevant emails for your sequences.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Your company name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-description">Description</Label>
              <Textarea
                id="company-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe what your company does, who you serve, and what makes you different..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Be specific. Include your industry, target market, and unique value.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Products or Services</Label>
              <div className="flex gap-2">
                <Input
                  value={newProduct}
                  onChange={(e) => setNewProduct(e.target.value)}
                  placeholder="Add a product or service"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addProduct())}
                />
                <Button type="button" variant="outline" onClick={addProduct}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formProducts.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formProducts.map((product, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {product}
                      <button
                        type="button"
                        onClick={() => removeProduct(i)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Value Propositions</Label>
              <div className="flex gap-2">
                <Input
                  value={newValueProp}
                  onChange={(e) => setNewValueProp(e.target.value)}
                  placeholder="e.g., Save 40% on operational costs"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addValueProp())}
                />
                <Button type="button" variant="outline" onClick={addValueProp}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Key benefits or reasons why prospects should care about your solution.
              </p>
              {formValueProps.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formValueProps.map((vp, i) => (
                    <Badge key={i} variant="outline" className="gap-1">
                      {vp}
                      <button
                        type="button"
                        onClick={() => removeValueProp(i)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
