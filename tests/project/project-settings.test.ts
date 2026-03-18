import { describe, it, expect } from 'vitest';
import { projectSettingsSchema } from '@/lib/validators/project';
import { createAutomationSchema, testAutomationSchema } from '@/lib/validators/automation';

describe('Project Settings', () => {
  it('accepts quotes_enabled in project settings', () => {
    const result = projectSettingsSchema.safeParse({
      quotes_enabled: true,
    });

    expect(result.success).toBe(true);
  });

  it('accepts quotes_enabled alongside existing settings fields', () => {
    const result = projectSettingsSchema.safeParse({
      quotes_enabled: false,
      company_context: {
        name: 'GoodRev',
        products: ['CRM'],
      },
      customRoles: ['sales-ops'],
    });

    expect(result.success).toBe(true);
  });
});

describe('Quote Automation Support', () => {
  it('accepts quote status change triggers', () => {
    const result = createAutomationSchema.safeParse({
      name: 'Notify on accepted quote',
      trigger_type: 'quote.status_changed',
      trigger_config: {
        entity_type: 'quote',
        from_status: 'sent',
        to_status: 'accepted',
      },
      actions: [{ type: 'send_notification', config: {} }],
    });

    expect(result.success).toBe(true);
  });

  it('accepts quote.accepted and product entities in automation schemas', () => {
    const acceptedResult = createAutomationSchema.safeParse({
      name: 'Create task on quote accepted',
      trigger_type: 'quote.accepted',
      trigger_config: {
        entity_type: 'quote',
      },
      actions: [{ type: 'create_task', config: { title: 'Follow up' } }],
    });

    const productEntityResult = testAutomationSchema.safeParse({
      entity_type: 'product',
      entity_id: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(acceptedResult.success).toBe(true);
    expect(productEntityResult.success).toBe(true);
  });
});
