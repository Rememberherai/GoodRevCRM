'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AccountingCompanyOption {
  id: string;
  name: string;
  role: string;
}

interface CompaniesResponse {
  companies: AccountingCompanyOption[];
  selected_company_id: string | null;
}

export function AccountingCompanySwitcher() {
  const router = useRouter();
  const [companies, setCompanies] = useState<AccountingCompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isActive = true;

    async function loadCompanies() {
      try {
        const response = await fetch('/api/accounting/companies', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to load accounting companies');
        }

        const data = await response.json() as CompaniesResponse;
        if (!isActive) {
          return;
        }

        setCompanies(data.companies ?? []);
        const fallbackId = data.companies?.[0]?.id ?? '';
        setSelectedCompanyId(data.selected_company_id ?? fallbackId);
      } catch (error) {
        if (isActive) {
          console.error('Error loading accounting companies:', error);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadCompanies();

    return () => {
      isActive = false;
    };
  }, []);

  async function handleValueChange(nextCompanyId: string) {
    const previousCompanyId = selectedCompanyId;
    setSelectedCompanyId(nextCompanyId);

    try {
      const response = await fetch('/api/accounting/company/select', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: nextCompanyId }),
      });

      if (!response.ok) {
        throw new Error('Failed to switch accounting company');
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error('Error switching accounting company:', error);
      setSelectedCompanyId(previousCompanyId);
      toast.error('Failed to switch accounting company');
    }
  }

  if (isLoading || companies.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectedCompanyId}
        onValueChange={handleValueChange}
        disabled={isPending}
      >
        <SelectTrigger className="h-8 w-[140px] md:w-[220px]">
          <SelectValue placeholder="Select company" />
        </SelectTrigger>
        <SelectContent>
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              {company.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
