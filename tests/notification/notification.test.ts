import { describe, it, expect } from 'vitest';
import {
  notificationQuerySchema,
  markReadSchema,
  markAllReadSchema,
  archiveSchema,
  preferenceQuerySchema,
  updatePreferencesSchema,
  pushSubscriptionSchema,
  createNotificationSchema,
} from '@/lib/validators/notification';

describe('Notification Validators', () => {
  describe('notificationQuerySchema', () => {
    it('should parse valid query', () => {
      const input = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        is_read: 'true',
        type: 'task_assigned',
        limit: '25',
        offset: '10',
      };

      const result = notificationQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.project_id).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(result.data.is_read).toBe(true);
        expect(result.data.type).toBe('task_assigned');
        expect(result.data.limit).toBe(25);
        expect(result.data.offset).toBe(10);
      }
    });

    it('should use default limit and offset', () => {
      const input = {};

      const result = notificationQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should accept all valid notification types', () => {
      const types = [
        'task_assigned',
        'task_due',
        'task_overdue',
        'task_completed',
        'opportunity_assigned',
        'opportunity_won',
        'opportunity_lost',
        'opportunity_stage_changed',
        'mention',
        'comment',
        'reply',
        'email_received',
        'email_opened',
        'email_replied',
        'meeting_reminder',
        'meeting_scheduled',
        'import_completed',
        'export_ready',
        'team_invite',
        'team_member_joined',
        'system',
        'custom',
      ];

      for (const type of types) {
        const result = notificationQuerySchema.safeParse({ type });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid notification type', () => {
      const input = { type: 'invalid_type' };

      const result = notificationQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject limit > 100', () => {
      const input = { limit: '200' };

      const result = notificationQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should coerce string booleans for is_read', () => {
      const trueResult = notificationQuerySchema.safeParse({ is_read: 'true' });
      expect(trueResult.success).toBe(true);
      if (trueResult.success) {
        expect(trueResult.data.is_read).toBe(true);
      }

      const falseResult = notificationQuerySchema.safeParse({ is_read: 'false' });
      expect(falseResult.success).toBe(true);
      if (falseResult.success) {
        expect(falseResult.data.is_read).toBe(false);
      }
    });

    it('should coerce string booleans for is_archived', () => {
      const trueResult = notificationQuerySchema.safeParse({ is_archived: 'true' });
      expect(trueResult.success).toBe(true);
      if (trueResult.success) {
        expect(trueResult.data.is_archived).toBe(true);
      }
    });
  });

  describe('markReadSchema', () => {
    it('should validate mark_read with notification_ids', () => {
      const input = {
        notification_ids: ['123e4567-e89b-12d3-a456-426614174000'],
      };

      const result = markReadSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate multiple notification_ids', () => {
      const input = {
        notification_ids: [
          '123e4567-e89b-12d3-a456-426614174000',
          '223e4567-e89b-12d3-a456-426614174000',
        ],
      };

      const result = markReadSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require at least one notification_id', () => {
      const input = {
        notification_ids: [],
      };

      const result = markReadSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require valid UUIDs in notification_ids', () => {
      const input = {
        notification_ids: ['not-a-uuid'],
      };

      const result = markReadSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('markAllReadSchema', () => {
    it('should validate mark_all_read without project_id', () => {
      const input = {};

      const result = markAllReadSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate mark_all_read with project_id', () => {
      const input = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = markAllReadSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept null project_id', () => {
      const input = {
        project_id: null,
      };

      const result = markAllReadSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('archiveSchema', () => {
    it('should validate archive with notification_ids', () => {
      const input = {
        notification_ids: [
          '123e4567-e89b-12d3-a456-426614174000',
          '223e4567-e89b-12d3-a456-426614174000',
        ],
      };

      const result = archiveSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require at least one notification_id', () => {
      const input = {
        notification_ids: [],
      };

      const result = archiveSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('preferenceQuerySchema', () => {
    it('should parse valid project_id', () => {
      const input = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = preferenceQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.project_id).toBe('123e4567-e89b-12d3-a456-426614174000');
      }
    });

    it('should allow empty query', () => {
      const input = {};

      const result = preferenceQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid project_id UUID', () => {
      const input = {
        project_id: 'not-a-uuid',
      };

      const result = preferenceQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updatePreferencesSchema', () => {
    it('should validate valid preferences update', () => {
      const input = {
        preferences: [
          {
            notification_type: 'task_assigned',
            email_enabled: true,
            push_enabled: false,
            in_app_enabled: true,
          },
        ],
      };

      const result = updatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate multiple preferences', () => {
      const input = {
        preferences: [
          {
            notification_type: 'task_assigned',
            email_enabled: true,
          },
          {
            notification_type: 'opportunity_won',
            push_enabled: true,
          },
        ],
      };

      const result = updatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept project_id for project-specific preferences', () => {
      const input = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        preferences: [
          {
            notification_type: 'task_assigned',
            email_enabled: false,
          },
        ],
      };

      const result = updatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.project_id).toBe('123e4567-e89b-12d3-a456-426614174000');
      }
    });

    it('should require at least one preference', () => {
      const input = {
        preferences: [],
      };

      const result = updatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid notification_type', () => {
      const input = {
        preferences: [
          {
            notification_type: 'invalid_type',
            email_enabled: true,
          },
        ],
      };

      const result = updatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should allow partial channel settings', () => {
      const input = {
        preferences: [
          {
            notification_type: 'mention',
            email_enabled: true,
            // push_enabled and in_app_enabled not specified
          },
        ],
      };

      const result = updatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('pushSubscriptionSchema', () => {
    it('should validate valid push subscription', () => {
      const input = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
        auth: 'tBHItJI5svbpez7KI4CCXg',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      };

      const result = pushSubscriptionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow subscription without user_agent', () => {
      const input = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      };

      const result = pushSubscriptionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require endpoint', () => {
      const input = {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      };

      const result = pushSubscriptionSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require valid URL for endpoint', () => {
      const input = {
        endpoint: 'not-a-url',
        p256dh: 'key1',
        auth: 'key2',
      };

      const result = pushSubscriptionSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require both p256dh and auth', () => {
      const inputMissingAuth = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        p256dh: 'key1',
      };

      const result1 = pushSubscriptionSchema.safeParse(inputMissingAuth);
      expect(result1.success).toBe(false);

      const inputMissingP256dh = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        auth: 'key2',
      };

      const result2 = pushSubscriptionSchema.safeParse(inputMissingP256dh);
      expect(result2.success).toBe(false);
    });

    it('should require non-empty keys', () => {
      const input = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        p256dh: '',
        auth: '',
      };

      const result = pushSubscriptionSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('createNotificationSchema', () => {
    it('should validate valid notification', () => {
      const input = {
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'task_assigned',
        title: 'New task assigned',
        message: 'You have been assigned a new task.',
      };

      const result = createNotificationSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate notification with all fields', () => {
      const input = {
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        project_id: '223e4567-e89b-12d3-a456-426614174000',
        type: 'opportunity_won',
        title: 'Opportunity Won!',
        message: 'Congratulations! You closed the deal.',
        data: { opportunity_id: '323e4567-e89b-12d3-a456-426614174000', value: 50000 },
        entity_type: 'opportunity',
        entity_id: '323e4567-e89b-12d3-a456-426614174000',
        priority: 'high',
        action_url: 'https://example.com/opportunities/123',
      };

      const result = createNotificationSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require user_id', () => {
      const input = {
        type: 'task_assigned',
        title: 'New task',
        message: 'Task description',
      };

      const result = createNotificationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require valid notification type', () => {
      const input = {
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'invalid_type',
        title: 'Title',
        message: 'Message',
      };

      const result = createNotificationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require title and message', () => {
      const input = {
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'system',
      };

      const result = createNotificationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept all priority levels', () => {
      const priorities = ['low', 'normal', 'high', 'urgent'];

      for (const priority of priorities) {
        const result = createNotificationSchema.safeParse({
          user_id: '123e4567-e89b-12d3-a456-426614174000',
          type: 'system',
          title: 'Title',
          message: 'Message',
          priority,
        });
        expect(result.success).toBe(true);
      }
    });
  });
});
