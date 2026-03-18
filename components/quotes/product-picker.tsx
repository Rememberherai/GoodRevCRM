'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/product';

interface ProductPickerProps {
  value: string | null;
  onSelect: (product: Product | null) => void;
  disabled?: boolean;
}

export function ProductPicker({ value, onSelect, disabled }: ProductPickerProps) {
  const params = useParams();
  const slug = params.slug as string;
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!value) {
      setSelectedProduct(null);
      return;
    }

    const existing = products.find((product) => product.id === value);
    if (existing) {
      setSelectedProduct(existing);
      return;
    }

    fetch(`/api/projects/${slug}/products/${value}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch selected product');
        return res.json();
      })
      .then((data) => setSelectedProduct(data.product ?? null))
      .catch(() => setSelectedProduct(null));
  }, [value, slug, products]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/projects/${slug}/products?is_active=true&limit=100`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch products');
        return res.json();
      })
      .then((data) => {
        const nextProducts = data.products ?? [];
        setProducts(nextProducts);
        const nextSelected = nextProducts.find((product: Product) => product.id === value);
        if (nextSelected) {
          setSelectedProduct(nextSelected);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, slug, value]);

  const selected = selectedProduct ?? products.find((p) => p.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {selected ? selected.name : 'Select product...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search products..." />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Loading...' : 'No products found.'}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onSelect(null);
                  setOpen(false);
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                <span className="text-muted-foreground">None (manual entry)</span>
              </CommandItem>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  onSelect={() => {
                    onSelect(product);
                    setSelectedProduct(product);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn('mr-2 h-4 w-4', value === product.id ? 'opacity-100' : 'opacity-0')}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="truncate">{product.name}</span>
                    {product.default_price !== null && (
                      <span className="ml-2 text-muted-foreground text-sm">
                        ${Number(product.default_price).toFixed(2)}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
