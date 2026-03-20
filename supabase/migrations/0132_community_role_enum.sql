-- Migration 0132: Extend project_role enum with community roles
-- Must be a separate migration because ALTER TYPE ... ADD VALUE cannot be
-- used in the same transaction as statements that reference the new values.

ALTER TYPE public.project_role ADD VALUE IF NOT EXISTS 'staff';
ALTER TYPE public.project_role ADD VALUE IF NOT EXISTS 'case_manager';
ALTER TYPE public.project_role ADD VALUE IF NOT EXISTS 'contractor';
ALTER TYPE public.project_role ADD VALUE IF NOT EXISTS 'board_viewer';
