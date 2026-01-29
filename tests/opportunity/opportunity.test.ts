import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  opportunitySchema,
  createOpportunitySchema,
  updateOpportunitySchema,
} from '@/lib/validators/opportunity';

describe('Opportunity Validators', () => {
  describe('opportunitySchema', () => {
    it('validates a valid opportunity', () => {
      const result = opportunitySchema.safeParse({
        name: 'Enterprise Deal',
        stage: 'prospecting',
        currency: 'USD',
        amount: 100000,
        probability: 50,
      });
      expect(result.success).toBe(true);
    });

    it('requires name', () => {
      const result = opportunitySchema.safeParse({
        stage: 'prospecting',
        currency: 'USD',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.name).toBeDefined();
      }
    });

    it('requires stage', () => {
      const result = opportunitySchema.safeParse({
        name: 'Test Deal',
        currency: 'USD',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.stage).toBeDefined();
      }
    });

    it('requires currency', () => {
      const result = opportunitySchema.safeParse({
        name: 'Test Deal',
        stage: 'prospecting',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.currency).toBeDefined();
      }
    });

    it('validates stage enum', () => {
      const result = opportunitySchema.safeParse({
        name: 'Test Deal',
        stage: 'invalid_stage',
        currency: 'USD',
      });
      expect(result.success).toBe(false);
    });

    it('allows all valid stages', () => {
      const stages = [
        'prospecting',
        'qualification',
        'proposal',
        'negotiation',
        'closed_won',
        'closed_lost',
      ];

      stages.forEach((stage) => {
        const result = opportunitySchema.safeParse({
          name: 'Test Deal',
          stage,
          currency: 'USD',
        });
        expect(result.success).toBe(true);
      });
    });

    it('validates amount is positive', () => {
      const result = opportunitySchema.safeParse({
        name: 'Test Deal',
        stage: 'prospecting',
        currency: 'USD',
        amount: -1000,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.amount).toBeDefined();
      }
    });

    it('validates probability range 0-100', () => {
      const resultLow = opportunitySchema.safeParse({
        name: 'Test Deal',
        stage: 'prospecting',
        currency: 'USD',
        probability: -1,
      });
      expect(resultLow.success).toBe(false);

      const resultHigh = opportunitySchema.safeParse({
        name: 'Test Deal',
        stage: 'prospecting',
        currency: 'USD',
        probability: 101,
      });
      expect(resultHigh.success).toBe(false);

      const resultValid = opportunitySchema.safeParse({
        name: 'Test Deal',
        stage: 'prospecting',
        currency: 'USD',
        probability: 50,
      });
      expect(resultValid.success).toBe(true);
    });

    it('validates max length for name', () => {
      const result = opportunitySchema.safeParse({
        name: 'a'.repeat(201),
        stage: 'prospecting',
        currency: 'USD',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.name).toContain(
          'Name must be 200 characters or less'
        );
      }
    });

    it('validates max length for description', () => {
      const result = opportunitySchema.safeParse({
        name: 'Test Deal',
        stage: 'prospecting',
        currency: 'USD',
        description: 'a'.repeat(2001),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.description).toContain(
          'Description must be 2000 characters or less'
        );
      }
    });

    it('validates organization_id is UUID', () => {
      const result = opportunitySchema.safeParse({
        name: 'Test Deal',
        stage: 'prospecting',
        currency: 'USD',
        organization_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('validates primary_contact_id is UUID', () => {
      const result = opportunitySchema.safeParse({
        name: 'Test Deal',
        stage: 'prospecting',
        currency: 'USD',
        primary_contact_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('allows valid UUIDs for related entities', () => {
      const result = opportunitySchema.safeParse({
        name: 'Test Deal',
        stage: 'prospecting',
        currency: 'USD',
        organization_id: '550e8400-e29b-41d4-a716-446655440000',
        primary_contact_id: '550e8400-e29b-41d4-a716-446655440001',
        owner_id: '550e8400-e29b-41d4-a716-446655440002',
      });
      expect(result.success).toBe(true);
    });

    it('validates custom_fields as record', () => {
      const result = opportunitySchema.safeParse({
        name: 'Test Deal',
        stage: 'prospecting',
        currency: 'USD',
        custom_fields: {
          deal_type: 'new_business',
          contract_length: 12,
        },
      });
      expect(result.success).toBe(true);
    });

    it('allows optional tracking fields', () => {
      const result = opportunitySchema.safeParse({
        name: 'Test Deal',
        stage: 'prospecting',
        currency: 'USD',
        source: 'Website',
        campaign: 'Q1 Outbound',
        competitor: 'Competitor Inc',
      });
      expect(result.success).toBe(true);
    });

    it('allows won/lost reasons', () => {
      const wonResult = opportunitySchema.safeParse({
        name: 'Won Deal',
        stage: 'closed_won',
        currency: 'USD',
        won_reason: 'Better pricing and features',
      });
      expect(wonResult.success).toBe(true);

      const lostResult = opportunitySchema.safeParse({
        name: 'Lost Deal',
        stage: 'closed_lost',
        currency: 'USD',
        lost_reason: 'Went with competitor',
      });
      expect(lostResult.success).toBe(true);
    });
  });

  describe('createOpportunitySchema', () => {
    it('is the same as opportunitySchema', () => {
      const input = {
        name: 'Test Deal',
        stage: 'prospecting' as const,
        currency: 'USD',
      };
      const createResult = createOpportunitySchema.safeParse(input);
      const baseResult = opportunitySchema.safeParse(input);
      expect(createResult.success).toBe(baseResult.success);
    });
  });

  describe('updateOpportunitySchema', () => {
    it('allows partial updates', () => {
      const result = updateOpportunitySchema.safeParse({
        name: 'Updated Name',
      });
      expect(result.success).toBe(true);
    });

    it('allows updating only stage', () => {
      const result = updateOpportunitySchema.safeParse({
        stage: 'qualification',
      });
      expect(result.success).toBe(true);
    });

    it('allows updating only amount', () => {
      const result = updateOpportunitySchema.safeParse({
        amount: 150000,
      });
      expect(result.success).toBe(true);
    });

    it('allows empty update', () => {
      const result = updateOpportunitySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('still validates field constraints on update', () => {
      const result = updateOpportunitySchema.safeParse({
        probability: 150, // Invalid: over 100
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Opportunity Store', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('has initial state', async () => {
    const { useOpportunityStore } = await import('@/stores/opportunity');
    const state = useOpportunityStore.getState();

    expect(state.opportunities).toEqual([]);
    expect(state.currentOpportunity).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.stageFilter).toBeNull();
    expect(state.organizationFilter).toBeNull();
    expect(state.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0,
    });
  });

  it('sets opportunities', async () => {
    const { useOpportunityStore } = await import('@/stores/opportunity');
    const opportunities = [
      { id: '1', name: 'Deal 1', stage: 'prospecting' },
      { id: '2', name: 'Deal 2', stage: 'qualification' },
    ] as any;
    const pagination = { page: 1, limit: 50, total: 2, totalPages: 1 };

    useOpportunityStore.getState().setOpportunities(opportunities, pagination);

    const state = useOpportunityStore.getState();
    expect(state.opportunities).toEqual(opportunities);
    expect(state.pagination).toEqual(pagination);
  });

  it('adds opportunity', async () => {
    const { useOpportunityStore } = await import('@/stores/opportunity');
    const opportunity = { id: '1', name: 'New Deal', stage: 'prospecting' } as any;

    useOpportunityStore.getState().addOpportunity(opportunity);

    const state = useOpportunityStore.getState();
    expect(state.opportunities).toContainEqual(opportunity);
    expect(state.pagination.total).toBe(1);
  });

  it('updates opportunity', async () => {
    const { useOpportunityStore } = await import('@/stores/opportunity');
    const opportunity = { id: '1', name: 'Original', stage: 'prospecting' } as any;
    useOpportunityStore.getState().addOpportunity(opportunity);

    useOpportunityStore.getState().updateOpportunity('1', { name: 'Updated', stage: 'qualification' });

    const state = useOpportunityStore.getState();
    expect(state.opportunities[0]?.name).toBe('Updated');
    expect(state.opportunities[0]?.stage).toBe('qualification');
  });

  it('removes opportunity', async () => {
    const { useOpportunityStore } = await import('@/stores/opportunity');
    const opportunity = { id: '1', name: 'To Delete', stage: 'prospecting' } as any;
    useOpportunityStore.getState().addOpportunity(opportunity);

    useOpportunityStore.getState().removeOpportunity('1');

    const state = useOpportunityStore.getState();
    expect(state.opportunities).toHaveLength(0);
    expect(state.pagination.total).toBe(0);
  });

  it('sets current opportunity', async () => {
    const { useOpportunityStore } = await import('@/stores/opportunity');
    const opportunity = {
      id: '1',
      name: 'Current Deal',
      stage: 'prospecting',
      organization: null,
      primary_contact: null,
    } as any;

    useOpportunityStore.getState().setCurrentOpportunity(opportunity);

    const state = useOpportunityStore.getState();
    expect(state.currentOpportunity).toEqual(opportunity);
  });

  it('sets loading state', async () => {
    const { useOpportunityStore } = await import('@/stores/opportunity');

    useOpportunityStore.getState().setLoading(true);
    expect(useOpportunityStore.getState().isLoading).toBe(true);

    useOpportunityStore.getState().setLoading(false);
    expect(useOpportunityStore.getState().isLoading).toBe(false);
  });

  it('sets error state', async () => {
    const { useOpportunityStore } = await import('@/stores/opportunity');

    useOpportunityStore.getState().setError('Something went wrong');

    const state = useOpportunityStore.getState();
    expect(state.error).toBe('Something went wrong');
    expect(state.isLoading).toBe(false);
  });

  it('sets search query', async () => {
    const { useOpportunityStore } = await import('@/stores/opportunity');

    useOpportunityStore.getState().setSearchQuery('enterprise');

    const state = useOpportunityStore.getState();
    expect(state.searchQuery).toBe('enterprise');
    expect(state.pagination.page).toBe(1);
  });

  it('sets sorting', async () => {
    const { useOpportunityStore } = await import('@/stores/opportunity');

    useOpportunityStore.getState().setSorting('amount', 'desc');

    const state = useOpportunityStore.getState();
    expect(state.sortBy).toBe('amount');
    expect(state.sortOrder).toBe('desc');
    expect(state.pagination.page).toBe(1);
  });

  it('sets stage filter', async () => {
    const { useOpportunityStore } = await import('@/stores/opportunity');

    useOpportunityStore.getState().setStageFilter('qualification');

    const state = useOpportunityStore.getState();
    expect(state.stageFilter).toBe('qualification');
    expect(state.pagination.page).toBe(1);
  });

  it('sets organization filter', async () => {
    const { useOpportunityStore } = await import('@/stores/opportunity');

    useOpportunityStore.getState().setOrganizationFilter('org-123');

    const state = useOpportunityStore.getState();
    expect(state.organizationFilter).toBe('org-123');
    expect(state.pagination.page).toBe(1);
  });

  it('sets page', async () => {
    const { useOpportunityStore } = await import('@/stores/opportunity');

    useOpportunityStore.getState().setPage(3);

    const state = useOpportunityStore.getState();
    expect(state.pagination.page).toBe(3);
  });

  it('resets state', async () => {
    const { useOpportunityStore } = await import('@/stores/opportunity');
    const opportunity = { id: '1', name: 'Test', stage: 'prospecting' } as any;
    useOpportunityStore.getState().addOpportunity(opportunity);
    useOpportunityStore.getState().setSearchQuery('test');
    useOpportunityStore.getState().setStageFilter('qualification');
    useOpportunityStore.getState().setError('error');

    useOpportunityStore.getState().reset();

    const state = useOpportunityStore.getState();
    expect(state.opportunities).toEqual([]);
    expect(state.searchQuery).toBe('');
    expect(state.stageFilter).toBeNull();
    expect(state.error).toBeNull();
  });

  it('updates current opportunity when updating matching opportunity', async () => {
    const { useOpportunityStore } = await import('@/stores/opportunity');
    const opportunity = {
      id: '1',
      name: 'Current',
      stage: 'prospecting',
      organization: null,
      primary_contact: null,
    } as any;
    useOpportunityStore.getState().setCurrentOpportunity(opportunity);
    useOpportunityStore.getState().addOpportunity({ id: '1', name: 'Current', stage: 'prospecting' } as any);

    useOpportunityStore.getState().updateOpportunity('1', { name: 'Updated' });

    const state = useOpportunityStore.getState();
    expect(state.currentOpportunity?.name).toBe('Updated');
  });

  it('clears current opportunity when removing matching opportunity', async () => {
    const { useOpportunityStore } = await import('@/stores/opportunity');
    const opportunity = {
      id: '1',
      name: 'Current',
      stage: 'prospecting',
      organization: null,
      primary_contact: null,
    } as any;
    useOpportunityStore.getState().setCurrentOpportunity(opportunity);
    useOpportunityStore.getState().addOpportunity({ id: '1', name: 'Current', stage: 'prospecting' } as any);

    useOpportunityStore.getState().removeOpportunity('1');

    const state = useOpportunityStore.getState();
    expect(state.currentOpportunity).toBeNull();
  });
});
