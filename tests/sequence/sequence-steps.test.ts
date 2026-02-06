import { describe, it, expect } from 'vitest';
import {
  createStepSchema,
  updateStepSchema,
  callStepConfigSchema,
  taskStepConfigSchema,
  linkedinStepConfigSchema,
} from '@/lib/validators/sequence';
import {
  substituteVariables,
  substituteConfigVariables,
} from '@/lib/sequences/variables';
import type { VariableContext } from '@/lib/sequences/variables';
import {
  StepType,
  LinkedInActionType,
  StepPriority,
  STEP_TYPE_LABELS,
  STEP_TYPE_COLORS,
  LINKEDIN_ACTION_LABELS,
  PRIORITY_LABELS,
  DEFAULT_CALL_CONFIG,
  DEFAULT_TASK_CONFIG,
  DEFAULT_LINKEDIN_CONFIG,
} from '@/types/sequence';

describe('Sequence Step Types', () => {
  describe('Validators', () => {
    describe('createStepSchema', () => {
      it('accepts email step type', () => {
        const result = createStepSchema.safeParse({
          step_type: 'email',
          step_number: 1,
          subject: 'Test Subject',
          body_html: '<p>Hello</p>',
        });
        expect(result.success).toBe(true);
      });

      it('accepts sms step type', () => {
        const result = createStepSchema.safeParse({
          step_type: 'sms',
          step_number: 1,
          sms_body: 'Hi {{first_name}}, this is a test message',
        });
        expect(result.success).toBe(true);
      });

      it('accepts delay step type', () => {
        const result = createStepSchema.safeParse({
          step_type: 'delay',
          step_number: 2,
          delay_amount: 2,
          delay_unit: 'days',
        });
        expect(result.success).toBe(true);
      });

      it('accepts condition step type', () => {
        const result = createStepSchema.safeParse({
          step_type: 'condition',
          step_number: 3,
          condition: { type: 'opened' },
        });
        expect(result.success).toBe(true);
      });

      it('accepts call step type with config', () => {
        const result = createStepSchema.safeParse({
          step_type: 'call',
          step_number: 1,
          config: {
            title: 'Call {{first_name}}',
            description: 'Discuss partnership',
            priority: 'high',
            due_in_hours: 24,
          },
        });
        expect(result.success).toBe(true);
      });

      it('accepts task step type with config', () => {
        const result = createStepSchema.safeParse({
          step_type: 'task',
          step_number: 1,
          config: {
            title: 'Follow up with {{company_name}}',
            description: 'Send proposal',
            priority: 'medium',
            due_in_hours: 48,
          },
        });
        expect(result.success).toBe(true);
      });

      it('accepts linkedin step type with config', () => {
        const result = createStepSchema.safeParse({
          step_type: 'linkedin',
          step_number: 1,
          config: {
            action: 'send_connection',
            title: 'Connect with {{first_name}}',
            description: 'Expand network',
            message_template: 'Hi {{first_name}}, I would love to connect!',
            priority: 'medium',
            due_in_hours: 24,
          },
        });
        expect(result.success).toBe(true);
      });

      it('rejects invalid step type', () => {
        const result = createStepSchema.safeParse({
          step_type: 'invalid_type',
          step_number: 1,
        });
        expect(result.success).toBe(false);
      });

      it('rejects negative step number', () => {
        const result = createStepSchema.safeParse({
          step_type: 'email',
          step_number: -1,
        });
        expect(result.success).toBe(false);
      });

      it('rejects sms_body exceeding 1600 characters', () => {
        const result = createStepSchema.safeParse({
          step_type: 'sms',
          step_number: 1,
          sms_body: 'a'.repeat(1601),
        });
        expect(result.success).toBe(false);
      });
    });

    describe('updateStepSchema', () => {
      it('accepts partial updates', () => {
        const result = updateStepSchema.safeParse({
          subject: 'Updated Subject',
        });
        expect(result.success).toBe(true);
      });

      it('accepts config updates', () => {
        const result = updateStepSchema.safeParse({
          config: {
            title: 'Updated Task',
            description: '',
            priority: 'urgent',
            due_in_hours: 12,
          },
        });
        expect(result.success).toBe(true);
      });
    });

    describe('callStepConfigSchema', () => {
      it('validates required fields', () => {
        const result = callStepConfigSchema.safeParse({
          title: 'Call contact',
          description: 'Discuss proposal',
          priority: 'high',
          due_in_hours: 24,
        });
        expect(result.success).toBe(true);
      });

      it('rejects missing title', () => {
        const result = callStepConfigSchema.safeParse({
          description: 'Discuss proposal',
          priority: 'high',
          due_in_hours: 24,
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid priority', () => {
        const result = callStepConfigSchema.safeParse({
          title: 'Call contact',
          description: 'Discuss proposal',
          priority: 'super_urgent',
          due_in_hours: 24,
        });
        expect(result.success).toBe(false);
      });

      it('rejects due_in_hours exceeding 720', () => {
        const result = callStepConfigSchema.safeParse({
          title: 'Call contact',
          description: '',
          priority: 'high',
          due_in_hours: 800,
        });
        expect(result.success).toBe(false);
      });

      it('rejects due_in_hours less than 1', () => {
        const result = callStepConfigSchema.safeParse({
          title: 'Call contact',
          description: '',
          priority: 'high',
          due_in_hours: 0,
        });
        expect(result.success).toBe(false);
      });

      it('applies default values', () => {
        const result = callStepConfigSchema.parse({
          title: 'Call contact',
        });
        expect(result.description).toBe('');
        expect(result.priority).toBe('high');
        expect(result.due_in_hours).toBe(24);
      });
    });

    describe('taskStepConfigSchema', () => {
      it('validates required fields', () => {
        const result = taskStepConfigSchema.safeParse({
          title: 'Complete task',
          description: 'Send follow-up email',
          priority: 'medium',
          due_in_hours: 48,
        });
        expect(result.success).toBe(true);
      });

      it('applies default values', () => {
        const result = taskStepConfigSchema.parse({
          title: 'Complete task',
        });
        expect(result.description).toBe('');
        expect(result.priority).toBe('medium');
        expect(result.due_in_hours).toBe(48);
      });
    });

    describe('linkedinStepConfigSchema', () => {
      it('validates all linkedin action types', () => {
        const actions: LinkedInActionType[] = ['view_profile', 'send_connection', 'send_message'];

        for (const action of actions) {
          const result = linkedinStepConfigSchema.safeParse({
            action,
            title: 'LinkedIn action',
            description: '',
            message_template: '',
            priority: 'medium',
            due_in_hours: 24,
          });
          expect(result.success).toBe(true);
        }
      });

      it('rejects invalid action type', () => {
        const result = linkedinStepConfigSchema.safeParse({
          action: 'send_inmmail',
          title: 'LinkedIn action',
          description: '',
          message_template: '',
          priority: 'medium',
          due_in_hours: 24,
        });
        expect(result.success).toBe(false);
      });

      it('applies default values', () => {
        const result = linkedinStepConfigSchema.parse({
          action: 'view_profile',
          title: 'View profile',
        });
        expect(result.description).toBe('');
        expect(result.message_template).toBe('');
        expect(result.priority).toBe('medium');
        expect(result.due_in_hours).toBe(24);
      });
    });
  });

  describe('Variable Substitution', () => {
    const mockContext: VariableContext = {
      person: {
        id: 'person-123',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        job_title: 'CEO',
        phone: '+1-555-123-4567',
        mobile_phone: null,
        linkedin_url: 'https://linkedin.com/in/johndoe',
      },
      organization: {
        id: 'org-123',
        name: 'Acme Corp',
        domain: 'acme.com',
        industry: 'Technology',
        website: 'https://acme.com',
        linkedin_url: 'https://linkedin.com/company/acme',
      },
      sender: {
        id: 'user-123',
        email: 'sender@company.com',
        full_name: 'Jane Smith',
      },
    };

    describe('substituteVariables', () => {
      it('substitutes person variables', () => {
        const result = substituteVariables('Hello {{first_name}} {{last_name}}!', mockContext);
        expect(result).toBe('Hello John Doe!');
      });

      it('substitutes organization variables', () => {
        const result = substituteVariables('Company: {{company_name}} ({{company_domain}})', mockContext);
        expect(result).toBe('Company: Acme Corp (acme.com)');
      });

      it('substitutes sender variables', () => {
        const result = substituteVariables('From: {{sender_name}} <{{sender_email}}>', mockContext);
        expect(result).toBe('From: Jane Smith <sender@company.com>');
      });

      it('preserves unknown variables', () => {
        const result = substituteVariables('Hello {{unknown_var}}!', mockContext);
        expect(result).toBe('Hello {{unknown_var}}!');
      });

      it('handles missing person data gracefully', () => {
        const contextWithoutPerson: VariableContext = {
          person: null,
          organization: mockContext.organization,
          sender: mockContext.sender,
        };
        const result = substituteVariables('Hi {{first_name}}', contextWithoutPerson);
        expect(result).toBe('Hi {{first_name}}');
      });

      it('handles missing organization data gracefully', () => {
        const contextWithoutOrg: VariableContext = {
          person: mockContext.person,
          organization: null,
          sender: mockContext.sender,
        };
        const result = substituteVariables('Company: {{company_name}}', contextWithoutOrg);
        expect(result).toBe('Company: {{company_name}}');
      });
    });

    describe('substituteConfigVariables', () => {
      it('substitutes variables in config strings', () => {
        const config = {
          title: 'Call {{first_name}} {{last_name}}',
          description: 'At {{company_name}}',
          priority: 'high',
          due_in_hours: 24,
        };

        const result = substituteConfigVariables(config, mockContext);

        expect(result.title).toBe('Call John Doe');
        expect(result.description).toBe('At Acme Corp');
      });

      it('preserves non-string values in config', () => {
        const config = {
          title: 'Task for {{first_name}}',
          priority: 'high',
          due_in_hours: 48,
          enabled: true,
          count: 5,
        };

        const result = substituteConfigVariables(config, mockContext);

        expect(result.due_in_hours).toBe(48);
        expect(result.enabled).toBe(true);
        expect(result.count).toBe(5);
      });

      it('handles empty config gracefully', () => {
        const config = {};
        const result = substituteConfigVariables(config, mockContext);
        expect(result).toEqual({});
      });

      it('substitutes multiple variables in single string', () => {
        const config = {
          title: '{{first_name}} {{last_name}} at {{company_name}}',
        };

        const result = substituteConfigVariables(config, mockContext);

        expect(result.title).toBe('John Doe at Acme Corp');
      });
    });
  });

  describe('Type Definitions', () => {
    it('StepType includes all expected values', () => {
      const stepTypes: StepType[] = ['email', 'delay', 'condition', 'sms', 'call', 'task', 'linkedin'];

      for (const type of stepTypes) {
        expect(STEP_TYPE_LABELS[type]).toBeDefined();
        expect(STEP_TYPE_COLORS[type]).toBeDefined();
      }
    });

    it('LinkedInActionType includes all expected values', () => {
      const actions: LinkedInActionType[] = ['view_profile', 'send_connection', 'send_message'];

      for (const action of actions) {
        expect(LINKEDIN_ACTION_LABELS[action]).toBeDefined();
      }
    });

    it('StepPriority includes all expected values', () => {
      const priorities: StepPriority[] = ['low', 'medium', 'high', 'urgent'];

      for (const priority of priorities) {
        expect(PRIORITY_LABELS[priority]).toBeDefined();
      }
    });

    it('default configs have required fields', () => {
      // Call config
      expect(DEFAULT_CALL_CONFIG.title).toBeDefined();
      expect(DEFAULT_CALL_CONFIG.description).toBeDefined();
      expect(DEFAULT_CALL_CONFIG.priority).toBeDefined();
      expect(DEFAULT_CALL_CONFIG.due_in_hours).toBeGreaterThan(0);

      // Task config
      expect(DEFAULT_TASK_CONFIG.title).toBeDefined();
      expect(DEFAULT_TASK_CONFIG.description).toBeDefined();
      expect(DEFAULT_TASK_CONFIG.priority).toBeDefined();
      expect(DEFAULT_TASK_CONFIG.due_in_hours).toBeGreaterThan(0);

      // LinkedIn config
      expect(DEFAULT_LINKEDIN_CONFIG.action).toBeDefined();
      expect(DEFAULT_LINKEDIN_CONFIG.title).toBeDefined();
      expect(DEFAULT_LINKEDIN_CONFIG.description).toBeDefined();
      expect(DEFAULT_LINKEDIN_CONFIG.message_template).toBeDefined();
      expect(DEFAULT_LINKEDIN_CONFIG.priority).toBeDefined();
      expect(DEFAULT_LINKEDIN_CONFIG.due_in_hours).toBeGreaterThan(0);
    });

    it('default configs pass validation', () => {
      expect(callStepConfigSchema.safeParse(DEFAULT_CALL_CONFIG).success).toBe(true);
      expect(taskStepConfigSchema.safeParse(DEFAULT_TASK_CONFIG).success).toBe(true);
      expect(linkedinStepConfigSchema.safeParse(DEFAULT_LINKEDIN_CONFIG).success).toBe(true);
    });
  });

  describe('Step Type UI Labels', () => {
    it('all step types have human-readable labels', () => {
      expect(STEP_TYPE_LABELS.email).toBe('Email');
      expect(STEP_TYPE_LABELS.delay).toBe('Wait');
      expect(STEP_TYPE_LABELS.condition).toBe('Condition');
      expect(STEP_TYPE_LABELS.sms).toBe('SMS');
      expect(STEP_TYPE_LABELS.call).toBe('Phone Call');
      expect(STEP_TYPE_LABELS.task).toBe('Task');
      expect(STEP_TYPE_LABELS.linkedin).toBe('LinkedIn');
    });

    it('all step types have color definitions', () => {
      const stepTypes: StepType[] = ['email', 'delay', 'condition', 'sms', 'call', 'task', 'linkedin'];

      for (const type of stepTypes) {
        expect(STEP_TYPE_COLORS[type].bg).toMatch(/^bg-/);
        expect(STEP_TYPE_COLORS[type].text).toMatch(/^text-/);
      }
    });

    it('linkedin action types have labels', () => {
      expect(LINKEDIN_ACTION_LABELS.view_profile).toBe('View Profile');
      expect(LINKEDIN_ACTION_LABELS.send_connection).toBe('Send Connection Request');
      expect(LINKEDIN_ACTION_LABELS.send_message).toBe('Send Message');
    });

    it('priorities have labels', () => {
      expect(PRIORITY_LABELS.low).toBe('Low');
      expect(PRIORITY_LABELS.medium).toBe('Medium');
      expect(PRIORITY_LABELS.high).toBe('High');
      expect(PRIORITY_LABELS.urgent).toBe('Urgent');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty strings in variable substitution', () => {
      const context: VariableContext = {
        person: {
          id: 'p1',
          first_name: '',
          last_name: 'Doe',
          email: null,
          job_title: null,
          phone: null,
          mobile_phone: null,
          linkedin_url: null,
        },
        organization: null,
        sender: null,
      };

      const result = substituteVariables('Hello {{first_name}}!', context);
      expect(result).toBe('Hello {{first_name}}!');
    });

    it('validates delay units', () => {
      const validUnits = ['minutes', 'hours', 'days', 'weeks'];

      for (const unit of validUnits) {
        const result = createStepSchema.safeParse({
          step_type: 'delay',
          delay_amount: 1,
          delay_unit: unit,
        });
        expect(result.success).toBe(true);
      }

      const invalidResult = createStepSchema.safeParse({
        step_type: 'delay',
        delay_amount: 1,
        delay_unit: 'months',
      });
      expect(invalidResult.success).toBe(false);
    });

    it('validates condition types', () => {
      const validConditions = ['opened', 'clicked', 'not_opened', 'not_clicked'];

      for (const type of validConditions) {
        const result = createStepSchema.safeParse({
          step_type: 'condition',
          condition: { type },
        });
        expect(result.success).toBe(true);
      }
    });
  });
});
