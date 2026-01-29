import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  personSchema,
  createPersonSchema,
  updatePersonSchema,
  personOrganizationSchema,
} from '@/lib/validators/person';

describe('Person Validators', () => {
  describe('personSchema', () => {
    it('validates a valid person', () => {
      const result = personSchema.safeParse({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '+1 555-123-4567',
        job_title: 'Senior Engineer',
      });
      expect(result.success).toBe(true);
    });

    it('requires first_name', () => {
      const result = personSchema.safeParse({
        last_name: 'Doe',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.first_name).toBeDefined();
      }
    });

    it('requires last_name', () => {
      const result = personSchema.safeParse({
        first_name: 'John',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.last_name).toBeDefined();
      }
    });

    it('validates email format', () => {
      const result = personSchema.safeParse({
        first_name: 'John',
        last_name: 'Doe',
        email: 'not-an-email',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.email).toBeDefined();
      }
    });

    it('allows empty string for email', () => {
      const result = personSchema.safeParse({
        first_name: 'John',
        last_name: 'Doe',
        email: '',
      });
      expect(result.success).toBe(true);
    });

    it('validates linkedin_url format', () => {
      const result = personSchema.safeParse({
        first_name: 'John',
        last_name: 'Doe',
        linkedin_url: 'https://linkedin.com/in/johndoe',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid linkedin_url', () => {
      const result = personSchema.safeParse({
        first_name: 'John',
        last_name: 'Doe',
        linkedin_url: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('validates twitter_handle', () => {
      const result = personSchema.safeParse({
        first_name: 'John',
        last_name: 'Doe',
        twitter_handle: 'johndoe',
      });
      expect(result.success).toBe(true);
    });

    it('validates avatar_url format', () => {
      const result = personSchema.safeParse({
        first_name: 'John',
        last_name: 'Doe',
        avatar_url: 'https://example.com/photo.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('validates max length for first_name', () => {
      const result = personSchema.safeParse({
        first_name: 'a'.repeat(101),
        last_name: 'Doe',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.first_name).toContain(
          'First name must be 100 characters or less'
        );
      }
    });

    it('validates max length for notes', () => {
      const result = personSchema.safeParse({
        first_name: 'John',
        last_name: 'Doe',
        notes: 'a'.repeat(2001),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.notes).toContain(
          'Notes must be 2000 characters or less'
        );
      }
    });

    it('validates address fields', () => {
      const result = personSchema.safeParse({
        first_name: 'John',
        last_name: 'Doe',
        address_street: '123 Main St',
        address_city: 'San Francisco',
        address_state: 'California',
        address_postal_code: '94105',
        address_country: 'United States',
        timezone: 'America/Los_Angeles',
      });
      expect(result.success).toBe(true);
    });

    it('validates custom_fields as record', () => {
      const result = personSchema.safeParse({
        first_name: 'John',
        last_name: 'Doe',
        custom_fields: {
          preferred_contact: 'email',
          notes: 'VIP customer',
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createPersonSchema', () => {
    it('is the same as personSchema', () => {
      const input = {
        first_name: 'Jane',
        last_name: 'Smith',
      };
      const createResult = createPersonSchema.safeParse(input);
      const personResult = personSchema.safeParse(input);
      expect(createResult.success).toBe(personResult.success);
    });
  });

  describe('updatePersonSchema', () => {
    it('allows partial updates', () => {
      const result = updatePersonSchema.safeParse({
        first_name: 'Updated',
      });
      expect(result.success).toBe(true);
    });

    it('allows updating only email', () => {
      const result = updatePersonSchema.safeParse({
        email: 'new@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('allows empty update', () => {
      const result = updatePersonSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('still validates field constraints', () => {
      const result = updatePersonSchema.safeParse({
        first_name: '', // Empty first_name should fail min(1)
      });
      expect(result.success).toBe(false);
    });
  });

  describe('personOrganizationSchema', () => {
    it('validates a valid person-organization link', () => {
      const result = personOrganizationSchema.safeParse({
        organization_id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'CEO',
        department: 'Executive',
        is_primary: true,
      });
      expect(result.success).toBe(true);
    });

    it('requires organization_id', () => {
      const result = personOrganizationSchema.safeParse({
        title: 'CEO',
      });
      expect(result.success).toBe(false);
    });

    it('validates organization_id is UUID', () => {
      const result = personOrganizationSchema.safeParse({
        organization_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('allows optional fields', () => {
      const result = personOrganizationSchema.safeParse({
        organization_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('defaults is_primary to false', () => {
      const result = personOrganizationSchema.safeParse({
        organization_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_primary).toBe(false);
      }
    });
  });
});

describe('Person Store', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('has initial state', async () => {
    const { usePersonStore } = await import('@/stores/person');
    const state = usePersonStore.getState();

    expect(state.people).toEqual([]);
    expect(state.currentPerson).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.organizationFilter).toBeNull();
    expect(state.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0,
    });
  });

  it('sets people', async () => {
    const { usePersonStore } = await import('@/stores/person');
    const people = [
      { id: '1', first_name: 'John', last_name: 'Doe' },
      { id: '2', first_name: 'Jane', last_name: 'Smith' },
    ] as any;
    const pagination = { page: 1, limit: 50, total: 2, totalPages: 1 };

    usePersonStore.getState().setPeople(people, pagination);

    const state = usePersonStore.getState();
    expect(state.people).toEqual(people);
    expect(state.pagination).toEqual(pagination);
  });

  it('adds person', async () => {
    const { usePersonStore } = await import('@/stores/person');
    const person = { id: '1', first_name: 'New', last_name: 'Person' } as any;

    usePersonStore.getState().addPerson(person);

    const state = usePersonStore.getState();
    expect(state.people).toContainEqual(person);
    expect(state.pagination.total).toBe(1);
  });

  it('updates person', async () => {
    const { usePersonStore } = await import('@/stores/person');
    const person = { id: '1', first_name: 'Original', last_name: 'Person' } as any;
    usePersonStore.getState().addPerson(person);

    usePersonStore.getState().updatePerson('1', { first_name: 'Updated' });

    const state = usePersonStore.getState();
    expect(state.people[0]?.first_name).toBe('Updated');
  });

  it('removes person', async () => {
    const { usePersonStore } = await import('@/stores/person');
    const person = { id: '1', first_name: 'To', last_name: 'Delete' } as any;
    usePersonStore.getState().addPerson(person);

    usePersonStore.getState().removePerson('1');

    const state = usePersonStore.getState();
    expect(state.people).toHaveLength(0);
    expect(state.pagination.total).toBe(0);
  });

  it('sets current person', async () => {
    const { usePersonStore } = await import('@/stores/person');
    const person = { id: '1', first_name: 'Current', last_name: 'Person', organization_count: 2 } as any;

    usePersonStore.getState().setCurrentPerson(person);

    const state = usePersonStore.getState();
    expect(state.currentPerson).toEqual(person);
  });

  it('sets loading state', async () => {
    const { usePersonStore } = await import('@/stores/person');

    usePersonStore.getState().setLoading(true);
    expect(usePersonStore.getState().isLoading).toBe(true);

    usePersonStore.getState().setLoading(false);
    expect(usePersonStore.getState().isLoading).toBe(false);
  });

  it('sets error state', async () => {
    const { usePersonStore } = await import('@/stores/person');

    usePersonStore.getState().setError('Something went wrong');

    const state = usePersonStore.getState();
    expect(state.error).toBe('Something went wrong');
    expect(state.isLoading).toBe(false);
  });

  it('sets search query', async () => {
    const { usePersonStore } = await import('@/stores/person');

    usePersonStore.getState().setSearchQuery('john');

    const state = usePersonStore.getState();
    expect(state.searchQuery).toBe('john');
    expect(state.pagination.page).toBe(1);
  });

  it('sets sorting', async () => {
    const { usePersonStore } = await import('@/stores/person');

    usePersonStore.getState().setSorting('last_name', 'asc');

    const state = usePersonStore.getState();
    expect(state.sortBy).toBe('last_name');
    expect(state.sortOrder).toBe('asc');
    expect(state.pagination.page).toBe(1);
  });

  it('sets organization filter', async () => {
    const { usePersonStore } = await import('@/stores/person');

    usePersonStore.getState().setOrganizationFilter('org-123');

    const state = usePersonStore.getState();
    expect(state.organizationFilter).toBe('org-123');
    expect(state.pagination.page).toBe(1);
  });

  it('sets page', async () => {
    const { usePersonStore } = await import('@/stores/person');

    usePersonStore.getState().setPage(3);

    const state = usePersonStore.getState();
    expect(state.pagination.page).toBe(3);
  });

  it('resets state', async () => {
    const { usePersonStore } = await import('@/stores/person');
    const person = { id: '1', first_name: 'Test', last_name: 'Person' } as any;
    usePersonStore.getState().addPerson(person);
    usePersonStore.getState().setSearchQuery('test');
    usePersonStore.getState().setOrganizationFilter('org-123');
    usePersonStore.getState().setError('error');

    usePersonStore.getState().reset();

    const state = usePersonStore.getState();
    expect(state.people).toEqual([]);
    expect(state.searchQuery).toBe('');
    expect(state.organizationFilter).toBeNull();
    expect(state.error).toBeNull();
  });

  it('updates current person when updating matching person', async () => {
    const { usePersonStore } = await import('@/stores/person');
    const person = { id: '1', first_name: 'Current', last_name: 'Person', organization_count: 2 } as any;
    usePersonStore.getState().setCurrentPerson(person);
    usePersonStore.getState().addPerson({ id: '1', first_name: 'Current', last_name: 'Person' } as any);

    usePersonStore.getState().updatePerson('1', { first_name: 'Updated' });

    const state = usePersonStore.getState();
    expect(state.currentPerson?.first_name).toBe('Updated');
  });

  it('clears current person when removing matching person', async () => {
    const { usePersonStore } = await import('@/stores/person');
    const person = { id: '1', first_name: 'Current', last_name: 'Person', organization_count: 2 } as any;
    usePersonStore.getState().setCurrentPerson(person);
    usePersonStore.getState().addPerson({ id: '1', first_name: 'Current', last_name: 'Person' } as any);

    usePersonStore.getState().removePerson('1');

    const state = usePersonStore.getState();
    expect(state.currentPerson).toBeNull();
  });
});
