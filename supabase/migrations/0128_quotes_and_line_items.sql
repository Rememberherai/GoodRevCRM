-- Migration 0128: Quotes, Line Items, RPCs, and Triggers
-- Quotes with line items attached to opportunities, plus atomic RPCs for state transitions
-- NOTE: Idempotent — objects may already exist from a prior push

-- ============================================================
-- 1. Quote status enum
-- ============================================================

DO $$ BEGIN
    CREATE TYPE public.quote_status AS ENUM (
        'draft',
        'sent',
        'accepted',
        'rejected',
        'expired'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Composite unique on opportunities for cross-project FK
-- ============================================================

DO $$ BEGIN
    ALTER TABLE public.opportunities
        ADD CONSTRAINT uq_opportunities_id_project_id UNIQUE (id, project_id);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. Quotes table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL,
    title TEXT NOT NULL,
    quote_number TEXT,
    status public.quote_status NOT NULL DEFAULT 'draft',
    is_primary BOOLEAN NOT NULL DEFAULT false,
    valid_until DATE,
    notes TEXT,
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    discount_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',

    -- Metadata
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    -- Cross-project integrity: opportunity must be in same project
    CONSTRAINT fk_quotes_opportunity_project
        FOREIGN KEY (opportunity_id, project_id)
        REFERENCES public.opportunities(id, project_id)
        ON DELETE CASCADE
);

-- Only one primary quote per opportunity
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_one_primary_per_opportunity
    ON public.quotes(opportunity_id)
    WHERE is_primary = true AND deleted_at IS NULL;

-- Enable Row Level Security
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS set_quotes_updated_at ON public.quotes;
CREATE TRIGGER set_quotes_updated_at
    BEFORE UPDATE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_project_id ON public.quotes(project_id);
CREATE INDEX IF NOT EXISTS idx_quotes_opportunity_id ON public.quotes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_deleted_at ON public.quotes(deleted_at) WHERE deleted_at IS NULL;

-- RLS Policies (drop + recreate for idempotency)
DROP POLICY IF EXISTS "Members can view project quotes" ON public.quotes;
CREATE POLICY "Members can view project quotes"
    ON public.quotes
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.is_project_member(project_id)
    );

DROP POLICY IF EXISTS "Members can create quotes" ON public.quotes;
CREATE POLICY "Members can create quotes"
    ON public.quotes
    FOR INSERT
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

DROP POLICY IF EXISTS "Members can update quotes" ON public.quotes;
CREATE POLICY "Members can update quotes"
    ON public.quotes
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND public.has_project_role(project_id, 'member')
    )
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

DROP POLICY IF EXISTS "Members can delete quotes" ON public.quotes;
CREATE POLICY "Members can delete quotes"
    ON public.quotes
    FOR DELETE
    USING (
        public.has_project_role(project_id, 'member')
    );

-- Closed opportunities make quotes read-only
CREATE OR REPLACE FUNCTION public.validate_quote_opportunity_open()
RETURNS trigger AS $$
DECLARE
    v_opportunity_id UUID;
    v_opp_stage TEXT;
BEGIN
    v_opportunity_id := COALESCE(NEW.opportunity_id, OLD.opportunity_id);

    SELECT stage::text INTO v_opp_stage
        FROM public.opportunities
        WHERE id = v_opportunity_id
          AND deleted_at IS NULL;

    IF v_opp_stage IN ('closed_won', 'closed_lost') THEN
        RAISE EXCEPTION 'Cannot modify quotes on a closed opportunity';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_quote_opportunity_open ON public.quotes;
CREATE TRIGGER trg_validate_quote_opportunity_open
    BEFORE INSERT OR UPDATE OR DELETE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_quote_opportunity_open();

-- ============================================================
-- 4. Quote line items table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quote_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0
        CHECK (discount_percent >= 0 AND discount_percent <= 100),
    line_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.quote_line_items ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS set_quote_line_items_updated_at ON public.quote_line_items;
CREATE TRIGGER set_quote_line_items_updated_at
    BEFORE UPDATE ON public.quote_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote_id ON public.quote_line_items(quote_id);

-- RLS Policies (access via quote's project membership)
DROP POLICY IF EXISTS "Members can view quote line items" ON public.quote_line_items;
CREATE POLICY "Members can view quote line items"
    ON public.quote_line_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.quotes q
            WHERE q.id = quote_id
              AND q.deleted_at IS NULL
              AND public.is_project_member(q.project_id)
        )
    );

DROP POLICY IF EXISTS "Members can create quote line items" ON public.quote_line_items;
CREATE POLICY "Members can create quote line items"
    ON public.quote_line_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.quotes q
            WHERE q.id = quote_id
              AND q.deleted_at IS NULL
              AND public.has_project_role(q.project_id, 'member')
        )
    );

DROP POLICY IF EXISTS "Members can update quote line items" ON public.quote_line_items;
CREATE POLICY "Members can update quote line items"
    ON public.quote_line_items
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.quotes q
            WHERE q.id = quote_id
              AND q.deleted_at IS NULL
              AND public.has_project_role(q.project_id, 'member')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.quotes q
            WHERE q.id = quote_id
              AND q.deleted_at IS NULL
              AND public.has_project_role(q.project_id, 'member')
        )
    );

DROP POLICY IF EXISTS "Members can delete quote line items" ON public.quote_line_items;
CREATE POLICY "Members can delete quote line items"
    ON public.quote_line_items
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.quotes q
            WHERE q.id = quote_id
              AND public.has_project_role(q.project_id, 'member')
        )
    );

-- ============================================================
-- 5. Cross-project integrity trigger for line item product_id
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_line_item_product_project()
RETURNS trigger AS $$
BEGIN
    IF NEW.product_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.products p
            JOIN public.quotes q ON q.id = NEW.quote_id
            WHERE p.id = NEW.product_id
              AND p.project_id = q.project_id
              AND p.deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'Product does not belong to the same project as the quote';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_line_item_product ON public.quote_line_items;
CREATE TRIGGER trg_validate_line_item_product
    BEFORE INSERT OR UPDATE ON public.quote_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_line_item_product_project();

CREATE OR REPLACE FUNCTION public.validate_line_item_opportunity_open()
RETURNS trigger AS $$
DECLARE
    v_quote_id UUID;
    v_opp_stage TEXT;
BEGIN
    v_quote_id := COALESCE(NEW.quote_id, OLD.quote_id);

    SELECT o.stage::text INTO v_opp_stage
    FROM public.quotes q
    JOIN public.opportunities o ON o.id = q.opportunity_id
    WHERE q.id = v_quote_id
      AND q.deleted_at IS NULL
      AND o.deleted_at IS NULL;

    IF v_opp_stage IN ('closed_won', 'closed_lost') THEN
        RAISE EXCEPTION 'Cannot modify line items on a closed opportunity';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_line_item_opportunity_open ON public.quote_line_items;
CREATE TRIGGER trg_validate_line_item_opportunity_open
    BEFORE INSERT OR UPDATE OR DELETE ON public.quote_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_line_item_opportunity_open();

-- ============================================================
-- 6. Auto-compute line_total on insert/update
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_line_total()
RETURNS trigger AS $$
BEGIN
    NEW.line_total := NEW.quantity * NEW.unit_price * (1 - NEW.discount_percent / 100);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_line_total ON public.quote_line_items;
CREATE TRIGGER trg_compute_line_total
    BEFORE INSERT OR UPDATE ON public.quote_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.compute_line_total();

-- ============================================================
-- 7. Recompute quote totals function + trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.recompute_quote_totals(p_quote_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.quotes SET
        subtotal = COALESCE((
            SELECT SUM(quantity * unit_price)
            FROM public.quote_line_items WHERE quote_id = p_quote_id
        ), 0),
        discount_total = COALESCE((
            SELECT SUM(quantity * unit_price * discount_percent / 100)
            FROM public.quote_line_items WHERE quote_id = p_quote_id
        ), 0),
        total = COALESCE((
            SELECT SUM(line_total)
            FROM public.quote_line_items WHERE quote_id = p_quote_id
        ), 0)
    WHERE id = p_quote_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trg_recompute_quote_totals()
RETURNS trigger AS $$
DECLARE
    v_quote_id UUID;
BEGIN
    v_quote_id := COALESCE(NEW.quote_id, OLD.quote_id);
    PERFORM public.recompute_quote_totals(v_quote_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quote_line_items_recompute ON public.quote_line_items;
CREATE TRIGGER trg_quote_line_items_recompute
    AFTER INSERT OR UPDATE OR DELETE ON public.quote_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_recompute_quote_totals();

-- ============================================================
-- 8. Atomic RPC: accept_quote
-- Returns JSONB with transition data for automation events
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_quote(
    p_quote_id UUID,
    p_project_id UUID,
    p_sync_amount BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
    v_opp_id UUID;
    v_quote_project_id UUID;
    v_quote_total DECIMAL(15, 2);
    v_opp_stage TEXT;
    v_prev_status TEXT;
    v_auto_rejected JSONB;
BEGIN
    -- Fetch quote and verify tenant ownership
    SELECT opportunity_id, project_id, total
        INTO v_opp_id, v_quote_project_id, v_quote_total
        FROM public.quotes WHERE id = p_quote_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quote not found';
    END IF;
    IF v_quote_project_id != p_project_id THEN
        RAISE EXCEPTION 'Quote not in project';
    END IF;

    -- Only draft or sent quotes can be accepted
    v_prev_status := (SELECT status::text FROM public.quotes WHERE id = p_quote_id);
    IF v_prev_status NOT IN ('draft', 'sent') THEN
        RAISE EXCEPTION 'Only draft or sent quotes can be accepted';
    END IF;

    -- Check opportunity is not closed
    SELECT stage::text INTO v_opp_stage
        FROM public.opportunities WHERE id = v_opp_id AND deleted_at IS NULL;
    IF v_opp_stage IN ('closed_won', 'closed_lost') THEN
        RAISE EXCEPTION 'Cannot accept quote on a closed opportunity';
    END IF;

    -- Capture IDs of quotes that will be auto-rejected
    v_auto_rejected := COALESCE((
        SELECT jsonb_agg(id)
        FROM public.quotes
        WHERE opportunity_id = v_opp_id
          AND status = 'accepted'
          AND id != p_quote_id
          AND deleted_at IS NULL
    ), '[]'::jsonb);

    -- Reject any previously accepted quote on this opportunity
    UPDATE public.quotes SET status = 'rejected'
        WHERE opportunity_id = v_opp_id
          AND status = 'accepted'
          AND id != p_quote_id
          AND deleted_at IS NULL;

    -- Unset any existing primary
    UPDATE public.quotes SET is_primary = false
        WHERE opportunity_id = v_opp_id
          AND is_primary = true
          AND id != p_quote_id
          AND deleted_at IS NULL;

    -- Accept and set primary
    UPDATE public.quotes
        SET status = 'accepted', is_primary = true
        WHERE id = p_quote_id;

    -- Optionally sync amount to opportunity (scoped by project)
    IF p_sync_amount THEN
        UPDATE public.opportunities
            SET amount = v_quote_total
            WHERE id = v_opp_id AND project_id = p_project_id;
    END IF;

    RETURN jsonb_build_object(
        'accepted_quote_id', p_quote_id,
        'accepted_quote_prev_status', v_prev_status,
        'auto_rejected_quote_ids', v_auto_rejected
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 9. Atomic RPC: set_primary_quote
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_primary_quote(
    p_quote_id UUID,
    p_project_id UUID
) RETURNS void AS $$
DECLARE
    v_opp_id UUID;
    v_quote_project_id UUID;
    v_quote_status public.quote_status;
    v_opp_stage TEXT;
BEGIN
    SELECT opportunity_id, project_id, status
        INTO v_opp_id, v_quote_project_id, v_quote_status
        FROM public.quotes WHERE id = p_quote_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quote not found';
    END IF;
    IF v_quote_project_id != p_project_id THEN
        RAISE EXCEPTION 'Quote not in project';
    END IF;

    -- Only draft/sent/accepted quotes can be primary
    IF v_quote_status NOT IN ('draft', 'sent', 'accepted') THEN
        RAISE EXCEPTION 'Cannot set a % quote as primary', v_quote_status;
    END IF;

    -- Check opportunity is not closed
    SELECT stage::text INTO v_opp_stage
        FROM public.opportunities WHERE id = v_opp_id AND deleted_at IS NULL;
    IF v_opp_stage IN ('closed_won', 'closed_lost') THEN
        RAISE EXCEPTION 'Cannot modify quotes on a closed opportunity';
    END IF;

    -- Unset existing primary
    UPDATE public.quotes SET is_primary = false
        WHERE opportunity_id = v_opp_id
          AND is_primary = true
          AND id != p_quote_id
          AND deleted_at IS NULL;

    -- Set new primary
    UPDATE public.quotes SET is_primary = true
        WHERE id = p_quote_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 10. Atomic RPC: replace_quote_line_items
-- Replaces all line items in a single transaction
-- ============================================================

CREATE OR REPLACE FUNCTION public.replace_quote_line_items(
    p_quote_id UUID,
    p_project_id UUID,
    p_items JSONB DEFAULT '[]'::jsonb
) RETURNS void AS $$
DECLARE
    v_quote_project_id UUID;
    v_opp_id UUID;
    v_opp_stage TEXT;
BEGIN
    SELECT project_id, opportunity_id
        INTO v_quote_project_id, v_opp_id
        FROM public.quotes
        WHERE id = p_quote_id
          AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quote not found';
    END IF;

    IF v_quote_project_id != p_project_id THEN
        RAISE EXCEPTION 'Quote not in project';
    END IF;

    SELECT stage::text INTO v_opp_stage
        FROM public.opportunities
        WHERE id = v_opp_id
          AND deleted_at IS NULL;

    IF v_opp_stage IN ('closed_won', 'closed_lost') THEN
        RAISE EXCEPTION 'Cannot modify line items on a closed opportunity';
    END IF;

    IF jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) <> 'array' THEN
        RAISE EXCEPTION 'Line items payload must be a JSON array';
    END IF;

    DELETE FROM public.quote_line_items
    WHERE quote_id = p_quote_id;

    INSERT INTO public.quote_line_items (
        quote_id,
        product_id,
        name,
        description,
        quantity,
        unit_price,
        discount_percent,
        sort_order
    )
    SELECT
        p_quote_id,
        NULLIF(item->>'product_id', '')::uuid,
        item->>'name',
        NULLIF(item->>'description', ''),
        COALESCE((item->>'quantity')::numeric, 1),
        COALESCE((item->>'unit_price')::numeric, 0),
        COALESCE((item->>'discount_percent')::numeric, 0),
        COALESCE((item->>'sort_order')::integer, ordinality - 1)
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) WITH ORDINALITY AS payload(item, ordinality);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 11. Revoke direct RPC access from app roles
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.accept_quote(uuid, uuid, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_primary_quote(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.replace_quote_line_items(uuid, uuid, jsonb) FROM anon, authenticated;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE public.quotes IS 'Quotes attached to opportunities with line items';
COMMENT ON TABLE public.quote_line_items IS 'Individual line items within a quote';
COMMENT ON COLUMN public.quotes.is_primary IS 'Only one primary quote per opportunity (enforced by partial unique index)';
COMMENT ON COLUMN public.quotes.currency IS 'Inherited from opportunity at creation, not independently editable';
COMMENT ON COLUMN public.quote_line_items.product_id IS 'Reference to catalog product; name/price are snapshots, not live bindings';
COMMENT ON COLUMN public.quote_line_items.line_total IS 'Auto-computed by trigger: quantity * unit_price * (1 - discount_percent/100)';
COMMENT ON FUNCTION public.accept_quote IS 'Atomic: accepts quote, auto-rejects prior accepted, sets primary, optionally syncs amount';
COMMENT ON FUNCTION public.set_primary_quote IS 'Atomic: sets primary quote, unsets any existing primary on same opportunity';
COMMENT ON FUNCTION public.replace_quote_line_items IS 'Atomic: replaces all quote line items in a single transaction';
