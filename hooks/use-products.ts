'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Product } from '@/types/product';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function useProducts() {
  const params = useParams();
  const slug = params.slug as string;
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | null>(true);

  const loadProducts = useCallback(async () => {
    if (!slug) return;
    setIsLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      if (search) qp.set('search', search);
      if (activeFilter !== null) qp.set('is_active', String(activeFilter));

      const res = await fetch(`/api/projects/${slug}/products?${qp}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      setProducts(data.products);
      if (data.pagination) setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [slug, pagination.page, pagination.limit, search, activeFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [search, activeFilter]);

  const create = useCallback(async (input: Record<string, unknown>) => {
    const res = await fetch(`/api/projects/${slug}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create product');
    }
    const data = await res.json();
    await loadProducts();
    return data.product as Product;
  }, [slug, loadProducts]);

  const update = useCallback(async (id: string, input: Record<string, unknown>) => {
    const res = await fetch(`/api/projects/${slug}/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to update product');
    }
    const data = await res.json();
    await loadProducts();
    return data.product as Product;
  }, [slug, loadProducts]);

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/projects/${slug}/products/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete product');
    await loadProducts();
  }, [slug, loadProducts]);

  const goToPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  return {
    products,
    pagination,
    isLoading,
    error,
    search,
    activeFilter,
    setSearch,
    setActiveFilter,
    create,
    update,
    remove,
    goToPage,
    reload: loadProducts,
  };
}
