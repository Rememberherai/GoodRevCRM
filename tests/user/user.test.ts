import { describe, it, expect } from 'vitest';
import {
  inviteMemberSchema,
  updateMemberRoleSchema,
  userSettingsSchema,
  updateProfileSchema,
  memberQuerySchema,
  invitationQuerySchema,
} from '@/lib/validators/user';

describe('User Validators', () => {
  describe('inviteMemberSchema', () => {
    it('should validate a valid invitation', () => {
      const input = {
        email: 'test@example.com',
        role: 'member',
      };

      const result = inviteMemberSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require valid email', () => {
      const input = {
        email: 'not-an-email',
        role: 'member',
      };

      const result = inviteMemberSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should allow role to be optional', () => {
      const input = {
        email: 'test@example.com',
      };

      const result = inviteMemberSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBeUndefined();
      }
    });

    it('should accept all valid roles', () => {
      const roles = ['admin', 'member', 'viewer'];

      for (const role of roles) {
        const result = inviteMemberSchema.safeParse({
          email: 'test@example.com',
          role,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject owner role for invitations', () => {
      const input = {
        email: 'test@example.com',
        role: 'owner',
      };

      const result = inviteMemberSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateMemberRoleSchema', () => {
    it('should validate a valid role update', () => {
      const input = { role: 'admin' };

      const result = updateMemberRoleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept all valid roles', () => {
      const roles = ['admin', 'member', 'viewer'];

      for (const role of roles) {
        const result = updateMemberRoleSchema.safeParse({ role });
        expect(result.success).toBe(true);
      }
    });

    it('should reject owner role', () => {
      const input = { role: 'owner' };

      const result = updateMemberRoleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require role', () => {
      const input = {};

      const result = updateMemberRoleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('userSettingsSchema', () => {
    it('should validate valid settings', () => {
      const input = {
        theme: 'dark',
        timezone: 'America/New_York',
        date_format: 'MM/dd/yyyy',
        time_format: 'h:mm a',
        notifications_email: true,
        notifications_push: false,
        notifications_digest: 'weekly',
      };

      const result = userSettingsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow partial updates', () => {
      const input = {
        theme: 'light',
      };

      const result = userSettingsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow empty update', () => {
      const input = {};

      const result = userSettingsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept all valid themes', () => {
      const themes = ['light', 'dark', 'system'];

      for (const theme of themes) {
        const result = userSettingsSchema.safeParse({ theme });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid theme', () => {
      const input = { theme: 'invalid' };

      const result = userSettingsSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept all valid digest options', () => {
      const digests = ['realtime', 'daily', 'weekly', 'never'];

      for (const digest of digests) {
        const result = userSettingsSchema.safeParse({ notifications_digest: digest });
        expect(result.success).toBe(true);
      }
    });

    it('should accept nullable default_project_id', () => {
      const input = { default_project_id: null };

      const result = userSettingsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for default_project_id', () => {
      const input = { default_project_id: 'not-a-uuid' };

      const result = userSettingsSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateProfileSchema', () => {
    it('should validate valid profile update', () => {
      const input = {
        full_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
      };

      const result = updateProfileSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow partial updates', () => {
      const input = {
        full_name: 'John Doe',
      };

      const result = updateProfileSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow empty update', () => {
      const input = {};

      const result = updateProfileSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow nullable avatar_url', () => {
      const input = { avatar_url: null };

      const result = updateProfileSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require valid URL for avatar_url', () => {
      const input = { avatar_url: 'not-a-url' };

      const result = updateProfileSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject full_name longer than 255 characters', () => {
      const input = { full_name: 'a'.repeat(256) };

      const result = updateProfileSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty full_name', () => {
      const input = { full_name: '' };

      const result = updateProfileSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('memberQuerySchema', () => {
    it('should parse valid query', () => {
      const input = {
        role: 'admin',
        search: 'john',
        limit: '25',
        offset: '10',
      };

      const result = memberQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('admin');
        expect(result.data.search).toBe('john');
        expect(result.data.limit).toBe(25);
        expect(result.data.offset).toBe(10);
      }
    });

    it('should use default limit and offset', () => {
      const input = {};

      const result = memberQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should accept all valid roles', () => {
      const roles = ['owner', 'admin', 'member', 'viewer'];

      for (const role of roles) {
        const result = memberQuerySchema.safeParse({ role });
        expect(result.success).toBe(true);
      }
    });

    it('should reject limit > 100', () => {
      const input = { limit: '200' };

      const result = memberQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('invitationQuerySchema', () => {
    it('should parse valid query', () => {
      const input = {
        status: 'pending',
        limit: '15',
        offset: '5',
      };

      const result = invitationQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('pending');
        expect(result.data.limit).toBe(15);
        expect(result.data.offset).toBe(5);
      }
    });

    it('should accept all valid statuses', () => {
      const statuses = ['pending', 'accepted', 'expired'];

      for (const status of statuses) {
        const result = invitationQuerySchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('should use default limit and offset', () => {
      const input = {};

      const result = invitationQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should reject invalid status', () => {
      const input = { status: 'invalid' };

      const result = invitationQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
