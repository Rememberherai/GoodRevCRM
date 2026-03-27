import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createProjectSchema, updateProjectSchema } from '@/lib/validators/project';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

describe('Community Project Phase 2', () => {
  // --- 2.1: Validators ---
  describe('project validators', () => {
    it('requires framework and accounting selections for community projects', () => {
      const missingCommunityFields = createProjectSchema.safeParse({
        name: 'Community Hub',
        slug: 'community-hub',
        project_type: 'community',
      });

      const validCommunityProject = createProjectSchema.safeParse({
        name: 'Community Hub',
        slug: 'community-hub',
        project_type: 'community',
        framework_type: 'ccf',
        accounting_target: 'goodrev',
      });

      expect(missingCommunityFields.success).toBe(false);
      expect(validCommunityProject.success).toBe(true);
    });

    it('still allows standard projects without community-only fields', () => {
      const standardProject = createProjectSchema.safeParse({
        name: 'Sales CRM',
        slug: 'sales-crm',
        project_type: 'standard',
      });

      expect(standardProject.success).toBe(true);
    });

    it('accepts all three framework types', () => {
      for (const fw of ['ccf', 'vital_conditions', 'custom'] as const) {
        const result = createProjectSchema.safeParse({
          name: 'Test',
          slug: 'test',
          project_type: 'community',
          framework_type: fw,
          accounting_target: 'goodrev',
        });
        expect(result.success).toBe(true);
      }
    });

    it('accepts all three accounting targets', () => {
      for (const at of ['goodrev', 'quickbooks', 'none'] as const) {
        const result = createProjectSchema.safeParse({
          name: 'Test',
          slug: 'test',
          project_type: 'community',
          framework_type: 'ccf',
          accounting_target: at,
        });
        expect(result.success).toBe(true);
      }
    });

    it('update schema allows partial updates without community fields when project_type is absent', () => {
      const result = updateProjectSchema.safeParse({ name: 'Renamed' });
      expect(result.success).toBe(true);
    });

    it('update schema enforces community fields when project_type is community', () => {
      const result = updateProjectSchema.safeParse({
        project_type: 'community',
      });
      expect(result.success).toBe(false);
    });
  });

  // --- 2.1: Project creation API ---
  describe('project creation API route', () => {
    it('rolls back community project creation when framework setup fails', () => {
      const route = readProjectFile('app', 'api', 'projects', 'route.ts');

      expect(route).toContain("await serviceClient");
      expect(route).toContain(".from('projects')");
      expect(route).toContain(".delete()");
      expect(route).toContain('Failed to finish community project setup. The project was not created.');
    });

    it('imports createProjectSchema from shared validators (no duplicate schema)', () => {
      const route = readProjectFile('app', 'api', 'projects', 'route.ts');
      expect(route).toContain("from '@/lib/validators/project'");
    });
  });

  // --- 2.1: New project dialog ---
  describe('new project dialog', () => {
    it('uses shared validator instead of local duplicate schema', () => {
      const dialog = readProjectFile('components', 'projects', 'new-project-dialog.tsx');
      expect(dialog).toContain("from '@/lib/validators/project'");
      expect(dialog).not.toMatch(/const projectSchema = z\.object/);
    });

    it('renders all three wizard steps for community projects', () => {
      const dialog = readProjectFile('components', 'projects', 'new-project-dialog.tsx');
      expect(dialog).toContain('Step 0: Project Type');
      expect(dialog).toContain('Step 1: Framework (community only)');
      expect(dialog).toContain('Accounting Target (community step 2, grants step 1)');
      expect(dialog).toContain('Details Step');
    });
  });

  // --- 2.2: Sidebar navigation ---
  describe('community sidebar', () => {
    it('includes the Phase 2 minimum community navigation surface', () => {
      const sidebar = readProjectFile('components', 'layout', 'project-sidebar.tsx');

      expect(sidebar).toContain("{ title: 'Dashboard', href: '', icon: LayoutDashboard, resource: 'dashboard' }");
      expect(sidebar).toContain("{ title: 'Households', href: '/households', icon: Home, resource: 'households' }");
      expect(sidebar).toContain("{ title: 'People', href: '/people', icon: Users }");
      expect(sidebar).toContain("{ title: 'Organizations', href: '/organizations', icon: Building2 }");
      expect(sidebar).toContain("{ title: 'Reporting', href: '/reports', icon: BarChart3, resource: 'reports' }");
    });

    it('filters nav items by role for community projects', () => {
      const sidebar = readProjectFile('components', 'layout', 'project-sidebar.tsx');

      // board_viewer sees Dashboard + Reporting only
      expect(sidebar).toContain("role === 'board_viewer'");
      expect(sidebar).toContain("item.title === 'Dashboard' || item.title === 'Reporting'");

      // contractor sees Dashboard only
      expect(sidebar).toContain("role === 'contractor'");
      expect(sidebar).toContain("item.title === 'Dashboard'");
    });

    it('hides Settings from board_viewer and contractor in community projects', () => {
      const sidebar = readProjectFile('components', 'layout', 'project-sidebar.tsx');

      // Settings section should check role before rendering
      expect(sidebar).toContain("role === 'board_viewer' || role === 'contractor'");
    });

    it('receives role prop from layout', () => {
      const layout = readProjectFile('app', '(dashboard)', 'projects', '[slug]', 'layout.tsx');
      expect(layout).toContain("role={membership?.role");
    });
  });

  // --- 2.3: Community dashboard ---
  describe('community dashboard', () => {
    it('branches to the aggregate-safe community dashboard', () => {
      const dashboardPage = readProjectFile('app', '(dashboard)', 'projects', '[slug]', 'page.tsx');
      const dashboardRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'community', 'dashboard', 'route.ts');

      expect(dashboardPage).toContain("if (project?.project_type === 'community')");
      expect(dashboardPage).toContain("membership?.role !== 'board_viewer' && membership?.role !== 'contractor'");
      expect(dashboardRoute).toContain("project.project_type !== 'community'");
    });
  });
});
