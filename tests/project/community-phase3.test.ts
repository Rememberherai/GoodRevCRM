import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

describe('Community Project Phase 3', () => {
  describe('household create route', () => {
    it('requires intake permission before inline intake is created', () => {
      const route = readProjectFile('app', 'api', 'projects', '[slug]', 'households', 'route.ts');

      expect(route).toContain("if (intake) {");
      expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'intake', 'create')");
    });

    it('cleans up the household and fails when nested inserts fail', () => {
      const route = readProjectFile('app', 'api', 'projects', '[slug]', 'households', 'route.ts');

      expect(route).toContain('cleanupCreatedHousehold');
      expect(route).toContain("error: 'Failed to create household members'");
      expect(route).toContain("error: 'Failed to create household intake record'");
    });
  });

  describe('household detail route', () => {
    it('gates intake records behind intake:view permission', () => {
      const route = readProjectFile('app', 'api', 'projects', '[slug]', 'households', '[id]', 'route.ts');

      expect(route).toContain("checkCommunityPermission(role, 'intake', 'view')");
      expect(route).toContain('can_view_intake: canViewIntake');
      expect(route).toContain('Promise.resolve({ data: [], error: null })');
    });

    it('counts contributions using donor and recipient household foreign keys', () => {
      const route = readProjectFile('app', 'api', 'projects', '[slug]', 'households', '[id]', 'route.ts');

      expect(route).toContain(".eq('project_id', project.id)");
      expect(route).toContain('donor_household_id.eq.${id},recipient_household_id.eq.${id}');
      expect(route).toContain(".from('contributions')");
    });
  });

  describe('household detail client', () => {
    it('uses can_view_intake from the household payload instead of probing the intake endpoint', () => {
      const client = readProjectFile(
        'app',
        '(dashboard)',
        'projects',
        '[slug]',
        'households',
        '[id]',
        'household-detail-client.tsx'
      );

      expect(client).toContain('can_view_intake: boolean;');
      expect(client).toContain('setCanViewIntake(data.household.can_view_intake);');
      expect(client).not.toContain("fetch(`/api/projects/${slug}/households/${householdId}/intake`)");
    });
  });

  describe('community reports', () => {
    it('uses the PRD volunteer hour default rate', () => {
      const reports = readProjectFile('lib', 'community', 'reports.ts');
      expect(reports).toContain('hourlyRate = 33.49');
      expect(reports).not.toContain('hourlyRate = 29.95');
    });

    it('includes contractor hours in the community reports payload', () => {
      const reportsRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'community', 'reports', 'route.ts');
      const reportsLib = readProjectFile('lib', 'community', 'reports.ts');

      expect(reportsRoute).toContain("reportType === 'all' || reportType === 'contractor_hours'");
      expect(reportsLib).toContain('export interface ContractorHoursReport');
      expect(reportsLib).toContain('export async function getContractorHoursReport');
    });
  });

  describe('programs slice', () => {
    it('adds enrollment and attendance APIs for programs', () => {
      const enrollmentsRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'programs', '[id]', 'enrollments', 'route.ts');
      const attendanceRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'programs', '[id]', 'attendance', 'route.ts');
      const waiverHelpers = readProjectFile('lib', 'community', 'waivers.ts');

      expect(enrollmentsRoute).toContain("requireCommunityPermission(supabase, user.id, project.id, 'programs', 'create')");
      expect(enrollmentsRoute).toContain("waiver_status: requiresWaiver ? 'pending' : 'not_required'");
      expect(enrollmentsRoute).toContain('createWaiverForEnrollment');
      expect(enrollmentsRoute).toContain('waiver_document_id');
      expect(attendanceRoute).toContain("upsert(entries, { onConflict: 'program_id,person_id,date' })");
      expect(waiverHelpers).toContain("category', 'waiver'");
      expect(waiverHelpers).toContain("kind: 'program_waiver'");
      expect(waiverHelpers).toContain('Enrollment created with pending waiver status');
    });

    it('adds the program pages and attendance UI', () => {
      const programsPage = readProjectFile('app', '(dashboard)', 'projects', '[slug]', 'programs', 'programs-page-client.tsx');
      const programDetail = readProjectFile('app', '(dashboard)', 'projects', '[slug]', 'programs', '[id]', 'program-detail-client.tsx');
      const newProgramDialog = readProjectFile('components', 'community', 'programs', 'new-program-dialog.tsx');
      const batchAttendance = readProjectFile('components', 'community', 'programs', 'batch-attendance.tsx');

      expect(programsPage).toContain('New Program');
      expect(programDetail).toContain('<BatchAttendance');
      expect(programDetail).toContain('waiver_status');
      expect(newProgramDialog).toContain('waiver');
      expect(batchAttendance).toContain('Capture present, absent, and excused attendance by session date');
    });
  });

  describe('contributions slice', () => {
    it('adds contributions CRUD with program dimension auto-inheritance', () => {
      const route = readProjectFile('app', 'api', 'projects', '[slug]', 'contributions', 'route.ts');
      const detailRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'contributions', '[id]', 'route.ts');

      expect(route).toContain("await requireCommunityPermission(supabase, user.id, project.id, 'contributions', 'create')");
      expect(route).toContain("if (!dimensionId && validation.data.program_id)");
      expect(detailRoute).toContain("await requireCommunityPermission(supabase, user.id, project.id, 'contributions', 'update')");
    });

    it('adds the contributions page with donation and time log entry flows', () => {
      const page = readProjectFile('app', '(dashboard)', 'projects', '[slug]', 'contributions', 'contributions-page-client.tsx');
      const donationEntry = readProjectFile('components', 'community', 'contributions', 'donation-entry.tsx');
      const timeLogEntry = readProjectFile('components', 'community', 'contributions', 'time-log-entry.tsx');

      expect(page).toContain('<DonationEntry');
      expect(page).toContain('<TimeLogEntry');
      expect(donationEntry).toContain("'monetary' | 'in_kind' | 'grant'");
      expect(timeLogEntry).toContain("'volunteer_hours' | 'service'");
    });
  });

  describe('community assets slice', () => {
    it('adds community asset CRUD routes', () => {
      const route = readProjectFile('app', 'api', 'projects', '[slug]', 'community-assets', 'route.ts');
      const detailRoute = readProjectFile('app', 'api', 'projects', '[slug]', 'community-assets', '[id]', 'route.ts');

      expect(route).toContain("requireCommunityPermission(supabase, user.id, project.id, 'community_assets', 'create')");
      expect(detailRoute).toContain("requireCommunityPermission(supabase, user.id, project.id, 'community_assets', 'update')");
      expect(detailRoute).toContain("entityType: 'community_asset'");
    });

    it('adds community asset pages and dialog', () => {
      const page = readProjectFile('app', '(dashboard)', 'projects', '[slug]', 'community-assets', 'assets-page-client.tsx');
      const detail = readProjectFile('app', '(dashboard)', 'projects', '[slug]', 'community-assets', '[id]', 'asset-detail-client.tsx');
      const dialog = readProjectFile('components', 'community', 'assets', 'new-asset-dialog.tsx');

      expect(page).toContain('New Asset');
      expect(detail).toContain('Asset Details');
      expect(dialog).toContain('Steward Organization');
    });
  });

  describe('community navigation', () => {
    it('exposes the completed Phase 3 routes in the sidebar', () => {
      const sidebar = readProjectFile('components', 'layout', 'project-sidebar.tsx');

      expect(sidebar).toContain("{ title: 'Programs', href: '/programs', icon: CalendarRange, resource: 'programs' }");
      expect(sidebar).toContain("{ title: 'Contributions', href: '/contributions', icon: HandCoins, resource: 'contributions' }");
      expect(sidebar).toContain("{ title: 'Community Assets', href: '/community-assets', icon: Building2, resource: 'community_assets' }");
    });
  });

  describe('waiver completion sync', () => {
    it('updates enrollment waiver status when a waiver contract completes', () => {
      const signSubmitRoute = readProjectFile('app', 'api', 'sign', '[token]', 'submit', 'route.ts');
      const waiverHelpers = readProjectFile('lib', 'community', 'waivers.ts');

      expect(signSubmitRoute).toContain('syncEnrollmentFromCompletedWaiver');
      expect(waiverHelpers).toContain("customFields.kind !== 'program_waiver'");
      expect(waiverHelpers).toContain("waiver_status: 'signed'");
      expect(waiverHelpers).toContain("enrollment.status === 'waitlisted' ? 'active' : enrollment.status");
    });
  });
});
