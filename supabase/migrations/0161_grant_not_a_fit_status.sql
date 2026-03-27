-- Add "not_a_fit" grant status for grants disqualified during research
ALTER TABLE public.grants DROP CONSTRAINT IF EXISTS grants_status_check;
ALTER TABLE public.grants
  ADD CONSTRAINT grants_status_check
    CHECK (status IN ('researching', 'preparing', 'submitted', 'under_review', 'awarded', 'active', 'closed', 'declined', 'not_a_fit'));
