'use client';

import { useState, useRef, useEffect } from 'react';
import { Trash2, GripVertical, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { ProductPicker } from './product-picker';
import type { QuoteLineItem } from '@/types/quote';
import type { Product } from '@/types/product';

interface LineItemRowProps {
  item: QuoteLineItem;
  currency?: string | null;
  disabled?: boolean;
  onUpdate: (itemId: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}

export function LineItemRow({ item, currency, disabled, onUpdate, onDelete }: LineItemRowProps) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unitPrice, setUnitPrice] = useState(String(item.unit_price));
  const [discountPercent, setDiscountPercent] = useState(String(item.discount_percent));
  const [isDeleting, setIsDeleting] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(item.name === 'Untitled item' && !item.product_id);
  const focusedRef = useRef(false);

  // Sync from server props when not actively editing
  useEffect(() => {
    if (focusedRef.current) return;
    setName(item.name);
    setQuantity(String(item.quantity));
    setUnitPrice(String(item.unit_price));
    setDiscountPercent(String(item.discount_percent));
  }, [item.name, item.quantity, item.unit_price, item.discount_percent]);

  const lineTotal = Number(quantity) * Number(unitPrice) * (1 - Number(discountPercent) / 100);

  const handleFocus = () => { focusedRef.current = true; };
  const handleBlur = () => {
    focusedRef.current = false;
    const changes: Record<string, unknown> = {};
    if (name !== item.name) changes.name = name;
    if (Number(quantity) !== Number(item.quantity)) changes.quantity = Number(quantity);
    if (Number(unitPrice) !== Number(item.unit_price)) changes.unit_price = Number(unitPrice);
    if (Number(discountPercent) !== Number(item.discount_percent))
      changes.discount_percent = Number(discountPercent);
    if (Object.keys(changes).length > 0) {
      onUpdate(item.id, changes);
    }
  };

  const handleProductSelect = (product: Product | null) => {
    setShowProductPicker(false);
    if (product) {
      setName(product.name);
      if (product.default_price !== null) {
        setUnitPrice(String(product.default_price));
      }
      onUpdate(item.id, {
        product_id: product.id,
        name: product.name,
        unit_price: product.default_price ?? Number(unitPrice),
      });
    } else {
      // Manual entry — clear product link, let user type name
      setName('');
      onUpdate(item.id, { product_id: null, name: 'Untitled item' });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(item.id);
    } catch {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency ?? 'USD' }).format(val);

  return (
    <TableRow>
      <TableCell className="w-8 align-middle">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </TableCell>
      <TableCell className="min-w-[200px] align-middle">
        {showProductPicker ? (
          <ProductPicker
            value={item.product_id}
            onSelect={handleProductSelect}
            disabled={disabled}
            autoOpen
            onClose={() => setShowProductPicker(false)}
          />
        ) : (
          <div className="flex items-center gap-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              disabled={disabled}
              placeholder="Item name"
              className="h-8 text-sm flex-1"
            />
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setShowProductPicker(true)}
                title="Pick from product catalog"
              >
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="w-[100px] align-middle">
        <Input
          type="number"
          min="1"
          step="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          className="h-8 text-sm"
        />
      </TableCell>
      <TableCell className="w-[120px] align-middle">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          className="h-8 text-sm"
        />
      </TableCell>
      <TableCell className="w-[90px] align-middle">
        <Input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={discountPercent}
          onChange={(e) => setDiscountPercent(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          className="h-8 text-sm"
        />
      </TableCell>
      <TableCell className="w-[120px] text-right font-medium align-middle">
        {formatCurrency(lineTotal)}
      </TableCell>
      <TableCell className="w-[40px] align-middle">
        {!disabled && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
