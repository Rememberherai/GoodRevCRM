'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface StepContextProps {
  companyName: string;
  companyDescription: string;
  products: string[];
  valuePropositions: string[];
  onUpdate: (updates: Partial<{
    companyName: string;
    companyDescription: string;
    products: string[];
    valuePropositions: string[];
  }>) => void;
}

export function StepContext({
  companyName,
  companyDescription,
  products,
  valuePropositions,
  onUpdate,
}: StepContextProps) {
  const [newProduct, setNewProduct] = useState('');
  const [newValueProp, setNewValueProp] = useState('');

  const addProduct = () => {
    if (newProduct.trim()) {
      onUpdate({ products: [...products, newProduct.trim()] });
      setNewProduct('');
    }
  };

  const removeProduct = (index: number) => {
    onUpdate({ products: products.filter((_, i) => i !== index) });
  };

  const addValueProp = () => {
    if (newValueProp.trim()) {
      onUpdate({ valuePropositions: [...valuePropositions, newValueProp.trim()] });
      setNewValueProp('');
    }
  };

  const removeValueProp = (index: number) => {
    onUpdate({ valuePropositions: valuePropositions.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Tell us about your company</h3>
        <p className="text-sm text-muted-foreground">
          This information helps AI write authentic, relevant emails.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name *</Label>
          <Input
            id="companyName"
            value={companyName}
            onChange={(e) => onUpdate({ companyName: e.target.value })}
            placeholder="e.g., Acme Software"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="companyDescription">Company Description *</Label>
          <Textarea
            id="companyDescription"
            value={companyDescription}
            onChange={(e) => onUpdate({ companyDescription: e.target.value })}
            placeholder="Describe what your company does, who you serve, and what makes you different..."
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Be specific. Include your industry, target market, and unique value.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Products / Services (optional)</Label>
          <div className="flex gap-2">
            <Input
              value={newProduct}
              onChange={(e) => setNewProduct(e.target.value)}
              placeholder="Add a product or service"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addProduct();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addProduct}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {products.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {products.map((product, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {product}
                  <button
                    type="button"
                    onClick={() => removeProduct(index)}
                    className="hover:text-foreground ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Value Propositions (optional)</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Key benefits or reasons why prospects should care about your solution.
          </p>
          <div className="flex gap-2">
            <Input
              value={newValueProp}
              onChange={(e) => setNewValueProp(e.target.value)}
              placeholder="e.g., Save 40% on operational costs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addValueProp();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addValueProp}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {valuePropositions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {valuePropositions.map((prop, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {prop}
                  <button
                    type="button"
                    onClick={() => removeValueProp(index)}
                    className="hover:text-foreground ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
