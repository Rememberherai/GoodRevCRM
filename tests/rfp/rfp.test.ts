import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  rfpSchema,
  createRfpSchema,
  updateRfpSchema,
} from '@/lib/validators/rfp';

describe('RFP Validators', () => {
  describe('rfpSchema', () => {
    it('validates a valid RFP', () => {
      const result = rfpSchema.safeParse({
        title: 'IT Infrastructure RFP',
        status: 'identified',
        currency: 'USD',
        estimated_value: 500000,
        win_probability: 50,
      });
      expect(result.success).toBe(true);
    });

    it('requires title', () => {
      const result = rfpSchema.safeParse({
        status: 'identified',
        currency: 'USD',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.title).toBeDefined();
      }
    });

    it('requires status', () => {
      const result = rfpSchema.safeParse({
        title: 'Test RFP',
        currency: 'USD',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.status).toBeDefined();
      }
    });

    it('requires currency', () => {
      const result = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'identified',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.currency).toBeDefined();
      }
    });

    it('validates status enum', () => {
      const result = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'invalid_status',
        currency: 'USD',
      });
      expect(result.success).toBe(false);
    });

    it('allows all valid statuses', () => {
      const statuses = [
        'identified',
        'reviewing',
        'preparing',
        'submitted',
        'won',
        'lost',
        'no_bid',
      ];

      statuses.forEach((status) => {
        const result = rfpSchema.safeParse({
          title: 'Test RFP',
          status,
          currency: 'USD',
        });
        expect(result.success).toBe(true);
      });
    });

    it('validates estimated_value is positive', () => {
      const result = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'identified',
        currency: 'USD',
        estimated_value: -1000,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.estimated_value).toBeDefined();
      }
    });

    it('validates win_probability range 0-100', () => {
      const resultLow = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'identified',
        currency: 'USD',
        win_probability: -1,
      });
      expect(resultLow.success).toBe(false);

      const resultHigh = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'identified',
        currency: 'USD',
        win_probability: 101,
      });
      expect(resultHigh.success).toBe(false);

      const resultValid = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'identified',
        currency: 'USD',
        win_probability: 50,
      });
      expect(resultValid.success).toBe(true);
    });

    it('validates max length for title', () => {
      const result = rfpSchema.safeParse({
        title: 'a'.repeat(301),
        status: 'identified',
        currency: 'USD',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.title).toContain(
          'Title must be 300 characters or less'
        );
      }
    });

    it('validates max length for description', () => {
      const result = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'identified',
        currency: 'USD',
        description: 'a'.repeat(5001),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.description).toContain(
          'Description must be 5000 characters or less'
        );
      }
    });

    it('validates organization_id is UUID', () => {
      const result = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'identified',
        currency: 'USD',
        organization_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('validates opportunity_id is UUID', () => {
      const result = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'identified',
        currency: 'USD',
        opportunity_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('allows valid UUIDs for related entities', () => {
      const result = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'identified',
        currency: 'USD',
        organization_id: '550e8400-e29b-41d4-a716-446655440000',
        opportunity_id: '550e8400-e29b-41d4-a716-446655440001',
        owner_id: '550e8400-e29b-41d4-a716-446655440002',
      });
      expect(result.success).toBe(true);
    });

    it('validates submission_method enum', () => {
      const validMethods = ['email', 'portal', 'physical', 'other'];
      validMethods.forEach((method) => {
        const result = rfpSchema.safeParse({
          title: 'Test RFP',
          status: 'identified',
          currency: 'USD',
          submission_method: method,
        });
        expect(result.success).toBe(true);
      });

      const result = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'identified',
        currency: 'USD',
        submission_method: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('validates go_no_go_decision enum', () => {
      const validDecisions = ['go', 'no_go', 'pending'];
      validDecisions.forEach((decision) => {
        const result = rfpSchema.safeParse({
          title: 'Test RFP',
          status: 'identified',
          currency: 'USD',
          go_no_go_decision: decision,
        });
        expect(result.success).toBe(true);
      });
    });

    it('validates submission_portal_url is valid URL', () => {
      const result = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'identified',
        currency: 'USD',
        submission_portal_url: 'not-a-url',
      });
      expect(result.success).toBe(false);

      const validResult = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'identified',
        currency: 'USD',
        submission_portal_url: 'https://portal.example.com',
      });
      expect(validResult.success).toBe(true);
    });

    it('validates submission_email is valid email', () => {
      const result = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'identified',
        currency: 'USD',
        submission_email: 'not-an-email',
      });
      expect(result.success).toBe(false);

      const validResult = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'identified',
        currency: 'USD',
        submission_email: 'rfps@example.com',
      });
      expect(validResult.success).toBe(true);
    });

    it('validates custom_fields as record', () => {
      const result = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'identified',
        currency: 'USD',
        custom_fields: {
          contract_type: 'fixed',
          requires_clearance: true,
        },
      });
      expect(result.success).toBe(true);
    });

    it('allows empty string for URL fields', () => {
      const result = rfpSchema.safeParse({
        title: 'Test RFP',
        status: 'identified',
        currency: 'USD',
        submission_portal_url: '',
        submission_email: '',
        rfp_document_url: '',
        response_document_url: '',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createRfpSchema', () => {
    it('is the same as rfpSchema', () => {
      const input = {
        title: 'Test RFP',
        status: 'identified' as const,
        currency: 'USD',
      };
      const createResult = createRfpSchema.safeParse(input);
      const baseResult = rfpSchema.safeParse(input);
      expect(createResult.success).toBe(baseResult.success);
    });
  });

  describe('updateRfpSchema', () => {
    it('allows partial updates', () => {
      const result = updateRfpSchema.safeParse({
        title: 'Updated Title',
      });
      expect(result.success).toBe(true);
    });

    it('allows updating only status', () => {
      const result = updateRfpSchema.safeParse({
        status: 'preparing',
      });
      expect(result.success).toBe(true);
    });

    it('allows updating only estimated_value', () => {
      const result = updateRfpSchema.safeParse({
        estimated_value: 750000,
      });
      expect(result.success).toBe(true);
    });

    it('allows empty update', () => {
      const result = updateRfpSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('still validates field constraints on update', () => {
      const result = updateRfpSchema.safeParse({
        win_probability: 150, // Invalid: over 100
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('RFP Store', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('has initial state', async () => {
    const { useRfpStore } = await import('@/stores/rfp');
    const state = useRfpStore.getState();

    expect(state.rfps).toEqual([]);
    expect(state.currentRfp).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.statusFilter).toBeNull();
    expect(state.organizationFilter).toBeNull();
    expect(state.sortBy).toBe('due_date');
    expect(state.sortOrder).toBe('asc');
    expect(state.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0,
    });
  });

  it('sets rfps', async () => {
    const { useRfpStore } = await import('@/stores/rfp');
    const rfps = [
      { id: '1', title: 'RFP 1', status: 'identified' },
      { id: '2', title: 'RFP 2', status: 'reviewing' },
    ] as any;
    const pagination = { page: 1, limit: 50, total: 2, totalPages: 1 };

    useRfpStore.getState().setRfps(rfps, pagination);

    const state = useRfpStore.getState();
    expect(state.rfps).toEqual(rfps);
    expect(state.pagination).toEqual(pagination);
  });

  it('adds rfp', async () => {
    const { useRfpStore } = await import('@/stores/rfp');
    const rfp = { id: '1', title: 'New RFP', status: 'identified' } as any;

    useRfpStore.getState().addRfp(rfp);

    const state = useRfpStore.getState();
    expect(state.rfps).toContainEqual(rfp);
    expect(state.pagination.total).toBe(1);
  });

  it('updates rfp', async () => {
    const { useRfpStore } = await import('@/stores/rfp');
    const rfp = { id: '1', title: 'Original', status: 'identified' } as any;
    useRfpStore.getState().addRfp(rfp);

    useRfpStore.getState().updateRfp('1', { title: 'Updated', status: 'reviewing' });

    const state = useRfpStore.getState();
    expect(state.rfps[0]?.title).toBe('Updated');
    expect(state.rfps[0]?.status).toBe('reviewing');
  });

  it('removes rfp', async () => {
    const { useRfpStore } = await import('@/stores/rfp');
    const rfp = { id: '1', title: 'To Delete', status: 'identified' } as any;
    useRfpStore.getState().addRfp(rfp);

    useRfpStore.getState().removeRfp('1');

    const state = useRfpStore.getState();
    expect(state.rfps).toHaveLength(0);
    expect(state.pagination.total).toBe(0);
  });

  it('sets current rfp', async () => {
    const { useRfpStore } = await import('@/stores/rfp');
    const rfp = {
      id: '1',
      title: 'Current RFP',
      status: 'identified',
      organization: null,
      opportunity: null,
    } as any;

    useRfpStore.getState().setCurrentRfp(rfp);

    const state = useRfpStore.getState();
    expect(state.currentRfp).toEqual(rfp);
  });

  it('sets loading state', async () => {
    const { useRfpStore } = await import('@/stores/rfp');

    useRfpStore.getState().setLoading(true);
    expect(useRfpStore.getState().isLoading).toBe(true);

    useRfpStore.getState().setLoading(false);
    expect(useRfpStore.getState().isLoading).toBe(false);
  });

  it('sets error state', async () => {
    const { useRfpStore } = await import('@/stores/rfp');

    useRfpStore.getState().setError('Something went wrong');

    const state = useRfpStore.getState();
    expect(state.error).toBe('Something went wrong');
    expect(state.isLoading).toBe(false);
  });

  it('sets search query', async () => {
    const { useRfpStore } = await import('@/stores/rfp');

    useRfpStore.getState().setSearchQuery('infrastructure');

    const state = useRfpStore.getState();
    expect(state.searchQuery).toBe('infrastructure');
    expect(state.pagination.page).toBe(1);
  });

  it('sets sorting', async () => {
    const { useRfpStore } = await import('@/stores/rfp');

    useRfpStore.getState().setSorting('estimated_value', 'desc');

    const state = useRfpStore.getState();
    expect(state.sortBy).toBe('estimated_value');
    expect(state.sortOrder).toBe('desc');
    expect(state.pagination.page).toBe(1);
  });

  it('sets status filter', async () => {
    const { useRfpStore } = await import('@/stores/rfp');

    useRfpStore.getState().setStatusFilter('preparing');

    const state = useRfpStore.getState();
    expect(state.statusFilter).toBe('preparing');
    expect(state.pagination.page).toBe(1);
  });

  it('sets organization filter', async () => {
    const { useRfpStore } = await import('@/stores/rfp');

    useRfpStore.getState().setOrganizationFilter('org-123');

    const state = useRfpStore.getState();
    expect(state.organizationFilter).toBe('org-123');
    expect(state.pagination.page).toBe(1);
  });

  it('sets page', async () => {
    const { useRfpStore } = await import('@/stores/rfp');

    useRfpStore.getState().setPage(3);

    const state = useRfpStore.getState();
    expect(state.pagination.page).toBe(3);
  });

  it('resets state', async () => {
    const { useRfpStore } = await import('@/stores/rfp');
    const rfp = { id: '1', title: 'Test', status: 'identified' } as any;
    useRfpStore.getState().addRfp(rfp);
    useRfpStore.getState().setSearchQuery('test');
    useRfpStore.getState().setStatusFilter('preparing');
    useRfpStore.getState().setError('error');

    useRfpStore.getState().reset();

    const state = useRfpStore.getState();
    expect(state.rfps).toEqual([]);
    expect(state.searchQuery).toBe('');
    expect(state.statusFilter).toBeNull();
    expect(state.error).toBeNull();
  });

  it('updates current rfp when updating matching rfp', async () => {
    const { useRfpStore } = await import('@/stores/rfp');
    const rfp = {
      id: '1',
      title: 'Current',
      status: 'identified',
      organization: null,
      opportunity: null,
    } as any;
    useRfpStore.getState().setCurrentRfp(rfp);
    useRfpStore.getState().addRfp({ id: '1', title: 'Current', status: 'identified' } as any);

    useRfpStore.getState().updateRfp('1', { title: 'Updated' });

    const state = useRfpStore.getState();
    expect(state.currentRfp?.title).toBe('Updated');
  });

  it('clears current rfp when removing matching rfp', async () => {
    const { useRfpStore } = await import('@/stores/rfp');
    const rfp = {
      id: '1',
      title: 'Current',
      status: 'identified',
      organization: null,
      opportunity: null,
    } as any;
    useRfpStore.getState().setCurrentRfp(rfp);
    useRfpStore.getState().addRfp({ id: '1', title: 'Current', status: 'identified' } as any);

    useRfpStore.getState().removeRfp('1');

    const state = useRfpStore.getState();
    expect(state.currentRfp).toBeNull();
  });
});
