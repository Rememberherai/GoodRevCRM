-- Migration 0141: Fix self-referential RLS policy on users table
-- The "System admins can view all users" policy queries the users table
-- from within a policy on the users table, causing infinite recursion.
-- Fix: use the SECURITY DEFINER function is_system_admin() instead.

DROP POLICY IF EXISTS "System admins can view all users" ON public.users;
CREATE POLICY "System admins can view all users"
  ON public.users FOR SELECT
  USING (public.is_system_admin());
