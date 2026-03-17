'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { ContractDocumentStatus } from '@/types/contract';

interface Contract {
  id: string;
  title: string;
  description: string | null;
  status: ContractDocumentStatus;
  original_file_name: string;
  signing_order_type: string;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  organization?: { id: string; name: string } | null;
  person?: { id: string; first_name: string; last_name: string; email: string | null } | null;
  opportunity?: { id: string; title: string } | null;
  owner?: { id: string; full_name: string | null; email: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function useContracts() {
  const params = useParams();
  const slug = params.slug as string;
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const loadContracts = useCallback(async () => {
    if (!slug) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/projects/${slug}/contracts?${params}`);
      if (!res.ok) throw new Error('Failed to fetch contracts');
      const data = await res.json();
      setContracts(data.contracts);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [slug, pagination.page, pagination.limit, search, statusFilter]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  useEffect(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [search, statusFilter]);

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/projects/${slug}/contracts/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    setContracts((prev) => prev.filter((c) => c.id !== id));
  }, [slug]);

  const goToPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  return {
    contracts,
    pagination,
    isLoading,
    error,
    search,
    statusFilter,
    setSearch,
    setStatusFilter,
    remove,
    goToPage,
    reload: loadContracts,
  };
}
