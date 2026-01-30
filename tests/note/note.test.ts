import { describe, it, expect } from 'vitest';
import {
  createNoteSchema,
  updateNoteSchema,
  noteQuerySchema,
} from '@/lib/validators/note';

describe('Note Validators', () => {
  describe('createNoteSchema', () => {
    it('should validate a valid note with entity association', () => {
      const validNote = {
        content: 'Important meeting notes from the call',
        is_pinned: true,
        person_id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = createNoteSchema.safeParse(validNote);
      expect(result.success).toBe(true);
    });

    it('should require content', () => {
      const invalidNote = {
        is_pinned: true,
        person_id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = createNoteSchema.safeParse(invalidNote);
      expect(result.success).toBe(false);
    });

    it('should reject empty content', () => {
      const invalidNote = {
        content: '',
        person_id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = createNoteSchema.safeParse(invalidNote);
      expect(result.success).toBe(false);
    });

    it('should require at least one entity association', () => {
      const noteWithoutEntity = {
        content: 'A note without any entity',
      };

      const result = createNoteSchema.safeParse(noteWithoutEntity);
      expect(result.success).toBe(false);
    });

    it('should default is_pinned to false', () => {
      const note = {
        content: 'A note',
        person_id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = createNoteSchema.safeParse(note);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_pinned).toBe(false);
      }
    });

    it('should validate optional entity IDs as UUIDs', () => {
      const validNote = {
        content: 'Note content',
        person_id: '123e4567-e89b-12d3-a456-426614174000',
        organization_id: '123e4567-e89b-12d3-a456-426614174001',
        opportunity_id: '123e4567-e89b-12d3-a456-426614174002',
        rfp_id: '123e4567-e89b-12d3-a456-426614174003',
      };

      const result = createNoteSchema.safeParse(validNote);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUIDs for entity IDs', () => {
      const invalidNote = {
        content: 'Note',
        person_id: 'not-a-uuid',
      };

      const result = createNoteSchema.safeParse(invalidNote);
      expect(result.success).toBe(false);
    });

    it('should accept multiline content', () => {
      const note = {
        content: `Line 1
Line 2
Line 3`,
        organization_id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = createNoteSchema.safeParse(note);
      expect(result.success).toBe(true);
    });
  });

  describe('updateNoteSchema', () => {
    it('should allow partial updates', () => {
      const partialUpdate = {
        content: 'Updated content',
      };

      const result = updateNoteSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it('should allow updating is_pinned only', () => {
      const pinUpdate = {
        is_pinned: true,
      };

      const result = updateNoteSchema.safeParse(pinUpdate);
      expect(result.success).toBe(true);
    });

    it('should reject empty content when provided', () => {
      const invalidUpdate = {
        content: '',
      };

      const result = updateNoteSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should allow empty object (no updates)', () => {
      const result = updateNoteSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('noteQuerySchema', () => {
    it('should parse valid query params', () => {
      const query = {
        person_id: '123e4567-e89b-12d3-a456-426614174000',
        limit: '20',
        offset: '0',
      };

      const result = noteQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should use default limit and offset', () => {
      const query = {};

      const result = noteQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should filter by multiple entity IDs', () => {
      const query = {
        person_id: '123e4567-e89b-12d3-a456-426614174000',
        organization_id: '123e4567-e89b-12d3-a456-426614174001',
        opportunity_id: '123e4567-e89b-12d3-a456-426614174002',
        rfp_id: '123e4567-e89b-12d3-a456-426614174003',
      };

      const result = noteQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
    });

    it('should reject limit > 100', () => {
      const query = {
        limit: '200',
      };

      const result = noteQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    it('should accept limit at 100', () => {
      const query = {
        limit: '100',
      };

      const result = noteQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(100);
      }
    });

    it('should reject invalid entity IDs', () => {
      const query = {
        person_id: 'not-a-uuid',
      };

      const result = noteQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });
  });
});
