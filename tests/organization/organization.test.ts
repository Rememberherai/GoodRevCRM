import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  organizationSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
} from '@/lib/validators/organization';

describe('Organization Validators', () => {
  describe('organizationSchema', () => {
    it('validates a valid organization', () => {
      const result = organizationSchema.safeParse({
        name: 'Acme Corp',
        domain: 'acme.com',
        industry: 'Technology',
        website: 'https://acme.com',
        employee_count: 100,
        annual_revenue: 1000000,
      });
      expect(result.success).toBe(true);
    });

    it('requires name', () => {
      const result = organizationSchema.safeParse({
        domain: 'acme.com',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.name).toBeDefined();
      }
    });

    it('rejects name that is too long', () => {
      const result = organizationSchema.safeParse({
        name: 'a'.repeat(201),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.name).toContain(
          'Name must be 200 characters or less'
        );
      }
    });

    it('validates optional fields', () => {
      const result = organizationSchema.safeParse({
        name: 'Acme Corp',
      });
      expect(result.success).toBe(true);
    });

    it('validates website URL format', () => {
      const result = organizationSchema.safeParse({
        name: 'Acme Corp',
        website: 'not-a-url',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.website).toBeDefined();
      }
    });

    it('allows empty string for website', () => {
      const result = organizationSchema.safeParse({
        name: 'Acme Corp',
        website: '',
      });
      expect(result.success).toBe(true);
    });

    it('validates linkedin_url format', () => {
      const result = organizationSchema.safeParse({
        name: 'Acme Corp',
        linkedin_url: 'https://linkedin.com/company/acme',
      });
      expect(result.success).toBe(true);
    });

    it('validates logo_url format', () => {
      const result = organizationSchema.safeParse({
        name: 'Acme Corp',
        logo_url: 'https://example.com/logo.png',
      });
      expect(result.success).toBe(true);
    });

    it('validates employee_count is positive', () => {
      const result = organizationSchema.safeParse({
        name: 'Acme Corp',
        employee_count: -1,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.employee_count).toBeDefined();
      }
    });

    it('validates annual_revenue is positive', () => {
      const result = organizationSchema.safeParse({
        name: 'Acme Corp',
        annual_revenue: -1000,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.annual_revenue).toBeDefined();
      }
    });

    it('validates custom_fields as record', () => {
      const result = organizationSchema.safeParse({
        name: 'Acme Corp',
        custom_fields: {
          field1: 'value1',
          field2: 123,
        },
      });
      expect(result.success).toBe(true);
    });

    it('validates address fields', () => {
      const result = organizationSchema.safeParse({
        name: 'Acme Corp',
        address_street: '123 Main St',
        address_city: 'San Francisco',
        address_state: 'CA',
        address_postal_code: '94105',
        address_country: 'United States',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createOrganizationSchema', () => {
    it('is the same as organizationSchema', () => {
      const input = {
        name: 'Test Org',
        industry: 'Tech',
      };
      const createResult = createOrganizationSchema.safeParse(input);
      const orgResult = organizationSchema.safeParse(input);
      expect(createResult.success).toBe(orgResult.success);
    });
  });

  describe('updateOrganizationSchema', () => {
    it('allows partial updates', () => {
      const result = updateOrganizationSchema.safeParse({
        name: 'Updated Name',
      });
      expect(result.success).toBe(true);
    });

    it('allows updating only industry', () => {
      const result = updateOrganizationSchema.safeParse({
        industry: 'Healthcare',
      });
      expect(result.success).toBe(true);
    });

    it('allows empty update', () => {
      const result = updateOrganizationSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('still validates field constraints', () => {
      const result = updateOrganizationSchema.safeParse({
        name: '', // Empty name should fail min(1)
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Organization Store', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('has initial state', async () => {
    const { useOrganizationStore } = await import('@/stores/organization');
    const state = useOrganizationStore.getState();

    expect(state.organizations).toEqual([]);
    expect(state.currentOrganization).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0,
    });
  });

  it('sets organizations', async () => {
    const { useOrganizationStore } = await import('@/stores/organization');
    const organizations = [
      { id: '1', name: 'Org 1' },
      { id: '2', name: 'Org 2' },
    ] as any;
    const pagination = { page: 1, limit: 50, total: 2, totalPages: 1 };

    useOrganizationStore.getState().setOrganizations(organizations, pagination);

    const state = useOrganizationStore.getState();
    expect(state.organizations).toEqual(organizations);
    expect(state.pagination).toEqual(pagination);
  });

  it('adds organization', async () => {
    const { useOrganizationStore } = await import('@/stores/organization');
    const organization = { id: '1', name: 'New Org' } as any;

    useOrganizationStore.getState().addOrganization(organization);

    const state = useOrganizationStore.getState();
    expect(state.organizations).toContainEqual(organization);
    expect(state.pagination.total).toBe(1);
  });

  it('updates organization', async () => {
    const { useOrganizationStore } = await import('@/stores/organization');
    const organization = { id: '1', name: 'Original' } as any;
    useOrganizationStore.getState().addOrganization(organization);

    useOrganizationStore.getState().updateOrganization('1', { name: 'Updated' });

    const state = useOrganizationStore.getState();
    expect(state.organizations[0]?.name).toBe('Updated');
  });

  it('removes organization', async () => {
    const { useOrganizationStore } = await import('@/stores/organization');
    const organization = { id: '1', name: 'To Delete' } as any;
    useOrganizationStore.getState().addOrganization(organization);

    useOrganizationStore.getState().removeOrganization('1');

    const state = useOrganizationStore.getState();
    expect(state.organizations).toHaveLength(0);
    expect(state.pagination.total).toBe(0);
  });

  it('sets current organization', async () => {
    const { useOrganizationStore } = await import('@/stores/organization');
    const organization = { id: '1', name: 'Current', people_count: 5 } as any;

    useOrganizationStore.getState().setCurrentOrganization(organization);

    const state = useOrganizationStore.getState();
    expect(state.currentOrganization).toEqual(organization);
  });

  it('sets loading state', async () => {
    const { useOrganizationStore } = await import('@/stores/organization');

    useOrganizationStore.getState().setLoading(true);
    expect(useOrganizationStore.getState().isLoading).toBe(true);

    useOrganizationStore.getState().setLoading(false);
    expect(useOrganizationStore.getState().isLoading).toBe(false);
  });

  it('sets error state', async () => {
    const { useOrganizationStore } = await import('@/stores/organization');

    useOrganizationStore.getState().setError('Something went wrong');

    const state = useOrganizationStore.getState();
    expect(state.error).toBe('Something went wrong');
    expect(state.isLoading).toBe(false);
  });

  it('sets search query', async () => {
    const { useOrganizationStore } = await import('@/stores/organization');

    useOrganizationStore.getState().setSearchQuery('acme');

    const state = useOrganizationStore.getState();
    expect(state.searchQuery).toBe('acme');
    expect(state.pagination.page).toBe(1); // Resets to first page
  });

  it('sets sorting', async () => {
    const { useOrganizationStore } = await import('@/stores/organization');

    useOrganizationStore.getState().setSorting('name', 'asc');

    const state = useOrganizationStore.getState();
    expect(state.sortBy).toBe('name');
    expect(state.sortOrder).toBe('asc');
    expect(state.pagination.page).toBe(1); // Resets to first page
  });

  it('sets page', async () => {
    const { useOrganizationStore } = await import('@/stores/organization');

    useOrganizationStore.getState().setPage(3);

    const state = useOrganizationStore.getState();
    expect(state.pagination.page).toBe(3);
  });

  it('resets state', async () => {
    const { useOrganizationStore } = await import('@/stores/organization');
    const organization = { id: '1', name: 'Test' } as any;
    useOrganizationStore.getState().addOrganization(organization);
    useOrganizationStore.getState().setSearchQuery('test');
    useOrganizationStore.getState().setError('error');

    useOrganizationStore.getState().reset();

    const state = useOrganizationStore.getState();
    expect(state.organizations).toEqual([]);
    expect(state.searchQuery).toBe('');
    expect(state.error).toBeNull();
  });

  it('updates current organization when updating matching org', async () => {
    const { useOrganizationStore } = await import('@/stores/organization');
    const organization = { id: '1', name: 'Current', people_count: 5 } as any;
    useOrganizationStore.getState().setCurrentOrganization(organization);
    useOrganizationStore.getState().addOrganization({ id: '1', name: 'Current' } as any);

    useOrganizationStore.getState().updateOrganization('1', { name: 'Updated' });

    const state = useOrganizationStore.getState();
    expect(state.currentOrganization?.name).toBe('Updated');
  });

  it('clears current organization when removing matching org', async () => {
    const { useOrganizationStore } = await import('@/stores/organization');
    const organization = { id: '1', name: 'Current', people_count: 5 } as any;
    useOrganizationStore.getState().setCurrentOrganization(organization);
    useOrganizationStore.getState().addOrganization({ id: '1', name: 'Current' } as any);

    useOrganizationStore.getState().removeOrganization('1');

    const state = useOrganizationStore.getState();
    expect(state.currentOrganization).toBeNull();
  });
});
