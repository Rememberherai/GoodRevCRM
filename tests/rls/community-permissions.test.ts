import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '0133_community_project_type.sql'
);

describe('Community RLS Migration Coverage', () => {
  it('defines the community permission function and contractor job helper', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.community_has_permission');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.community_contractor_can_view_job');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.community_can_access_shared_directory');
  });

  it('includes RLS coverage for the critical community tables', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE public.household_intake ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE public.community_assets ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE public.grants ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;');
  });

  it('bridges shared directory tables for community roles without exposing contractor access', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('DROP POLICY IF EXISTS "Members can view project organizations" ON public.organizations;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Members can view project people" ON public.people;');
    expect(sql).toContain('DROP POLICY IF EXISTS "Members can view person-org links" ON public.person_organizations;');
    expect(sql).toContain('public.community_can_access_shared_directory(project_id, \'view\')');
  });

  it('uses community_assets consistently and prevents contractor job deletes', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toContain("p_resource IN ('households', 'programs', 'contributions', 'community_assets', 'referrals')");
    expect(sql).toContain("public.community_has_permission(project_id, 'community_assets', 'view')");
    expect(sql).toContain('CREATE POLICY jobs_delete ON public.jobs');
    expect(sql).not.toContain('CREATE POLICY jobs_write ON public.jobs');
  });

  it('documents the live RLS execution requirement for local DB validation', () => {
    expect(process.env.COMMUNITY_RLS_TEST_DB_URL ?? '').toBe('');
  });
});
