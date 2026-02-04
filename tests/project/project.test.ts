import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProjectSchema, updateProjectSchema, generateSlug } from '@/lib/validators/project';

describe('Project Validators', () => {
  describe('createProjectSchema', () => {
    it('should validate a valid project', () => {
      const result = createProjectSchema.safeParse({
        name: 'My Project',
        slug: 'my-project',
        description: 'A test project',
      });

      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const result = createProjectSchema.safeParse({
        slug: 'my-project',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.name).toBeDefined();
      }
    });

    it('should require slug', () => {
      const result = createProjectSchema.safeParse({
        name: 'My Project',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.slug).toBeDefined();
      }
    });

    it('should reject invalid slug format', () => {
      const result = createProjectSchema.safeParse({
        name: 'My Project',
        slug: 'My Project', // Contains uppercase and space
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.slug).toBeDefined();
      }
    });

    it('should accept slug with hyphens', () => {
      const result = createProjectSchema.safeParse({
        name: 'My Project',
        slug: 'my-awesome-project',
      });

      expect(result.success).toBe(true);
    });

    it('should reject name longer than 100 characters', () => {
      const result = createProjectSchema.safeParse({
        name: 'a'.repeat(101),
        slug: 'test',
      });

      expect(result.success).toBe(false);
    });

    it('should reject slug longer than 50 characters', () => {
      const result = createProjectSchema.safeParse({
        name: 'Test',
        slug: 'a'.repeat(51),
      });

      expect(result.success).toBe(false);
    });

    it('should allow null description', () => {
      const result = createProjectSchema.safeParse({
        name: 'My Project',
        slug: 'my-project',
        description: null,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('updateProjectSchema', () => {
    it('should allow partial updates', () => {
      const result = updateProjectSchema.safeParse({
        name: 'Updated Name',
      });

      expect(result.success).toBe(true);
    });

    it('should allow empty object', () => {
      const result = updateProjectSchema.safeParse({});

      expect(result.success).toBe(true);
    });
  });

  describe('generateSlug', () => {
    it('should convert name to lowercase', () => {
      expect(generateSlug('My Project')).toBe('my-project');
    });

    it('should replace spaces with hyphens', () => {
      expect(generateSlug('hello world')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(generateSlug('Hello! World?')).toBe('hello-world');
    });

    it('should handle multiple spaces', () => {
      expect(generateSlug('hello   world')).toBe('hello-world');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(generateSlug('  hello world  ')).toBe('hello-world');
    });

    it('should truncate to 50 characters', () => {
      const longName = 'a'.repeat(100);
      expect(generateSlug(longName).length).toBeLessThanOrEqual(50);
    });
  });
});

describe('Project Store', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should have initial empty state', async () => {
    const { useProjectStore } = await import('@/stores/project');
    const state = useProjectStore.getState();

    expect(state.currentProject).toBeNull();
    expect(state.projects).toEqual([]);
    expect(state.isLoading).toBe(false);
  });

  it('should set current project', async () => {
    const { useProjectStore } = await import('@/stores/project');
    const mockProject = {
      id: '1',
      name: 'Test',
      slug: 'test',
      description: null,
      logo_url: null,
      settings: {},
      owner_id: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    useProjectStore.getState().setCurrentProject(mockProject);

    expect(useProjectStore.getState().currentProject).toEqual(mockProject);
  });

  it('should add project to list', async () => {
    const { useProjectStore } = await import('@/stores/project');
    const mockProject = {
      id: '1',
      name: 'Test',
      slug: 'test',
      description: null,
      logo_url: null,
      settings: {},
      owner_id: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    useProjectStore.getState().addProject(mockProject);

    expect(useProjectStore.getState().projects).toHaveLength(1);
    expect(useProjectStore.getState().projects[0]).toEqual(mockProject);
  });

  it('should update project in list', async () => {
    const { useProjectStore } = await import('@/stores/project');
    const mockProject = {
      id: '1',
      name: 'Test',
      slug: 'test',
      description: null,
      logo_url: null,
      settings: {},
      owner_id: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    useProjectStore.getState().setProjects([mockProject]);
    useProjectStore.getState().updateProject('test', { name: 'Updated' });

    expect(useProjectStore.getState().projects[0]?.name).toBe('Updated');
  });

  it('should remove project from list', async () => {
    const { useProjectStore } = await import('@/stores/project');
    const mockProject = {
      id: '1',
      name: 'Test',
      slug: 'test',
      description: null,
      logo_url: null,
      settings: {},
      owner_id: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    useProjectStore.getState().setProjects([mockProject]);
    useProjectStore.getState().removeProject('test');

    expect(useProjectStore.getState().projects).toHaveLength(0);
  });
});
