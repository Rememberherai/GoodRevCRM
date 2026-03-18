-- Migration 0100: Currency exchange rates
-- Manual exchange rate table for multi-currency support.
-- Rates are looked up by effective date (most recent rate <= transaction date).

CREATE TABLE IF NOT EXISTS public.currency_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.accounting_companies(id) ON DELETE CASCADE,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate DECIMAL(15,6) NOT NULL CHECK (rate > 0),
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_currency_rate UNIQUE (company_id, from_currency, to_currency, effective_date)
);

-- Enable RLS
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

-- Triggers
CREATE TRIGGER set_currency_rates_updated_at
    BEFORE UPDATE ON public.currency_rates
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_currency_rates_company
    ON public.currency_rates(company_id);
CREATE INDEX IF NOT EXISTS idx_currency_rates_lookup
    ON public.currency_rates(company_id, from_currency, to_currency, effective_date DESC);

-- ============================================================
-- RLS Policies
-- ============================================================

CREATE POLICY "Members can view currency rates"
    ON public.currency_rates
    FOR SELECT
    USING (
        public.is_accounting_member(company_id)
    );

CREATE POLICY "Members can create currency rates"
    ON public.currency_rates
    FOR INSERT
    WITH CHECK (
        public.has_accounting_role(company_id, 'member')
    );

CREATE POLICY "Members can update currency rates"
    ON public.currency_rates
    FOR UPDATE
    USING (
        public.has_accounting_role(company_id, 'member')
    )
    WITH CHECK (
        public.has_accounting_role(company_id, 'member')
    );

CREATE POLICY "Admins can delete currency rates"
    ON public.currency_rates
    FOR DELETE
    USING (
        public.has_accounting_role(company_id, 'admin')
    );

-- ============================================================
-- Lookup function: get exchange rate for a currency pair on a date
-- Returns the most recent rate on or before the given date
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_exchange_rate(
    p_company_id UUID,
    p_from_currency TEXT,
    p_to_currency TEXT,
    p_date DATE
)
RETURNS DECIMAL(15,6) AS $$
DECLARE
    result DECIMAL(15,6);
BEGIN
    -- Same currency = 1.0
    IF p_from_currency = p_to_currency THEN
        RETURN 1.0;
    END IF;

    -- Look up the most recent rate on or before the date
    SELECT rate INTO result
    FROM public.currency_rates
    WHERE company_id = p_company_id
    AND from_currency = p_from_currency
    AND to_currency = p_to_currency
    AND effective_date <= p_date
    ORDER BY effective_date DESC
    LIMIT 1;

    IF result IS NULL THEN
        -- Try the inverse
        SELECT (1.0 / rate)::DECIMAL(15,6) INTO result
        FROM public.currency_rates
        WHERE company_id = p_company_id
        AND from_currency = p_to_currency
        AND to_currency = p_from_currency
        AND effective_date <= p_date
        ORDER BY effective_date DESC
        LIMIT 1;
    END IF;

    RETURN result;  -- NULL if no rate found
END;
$$ LANGUAGE plpgsql STABLE;

-- Comments
COMMENT ON TABLE public.currency_rates IS 'Manual exchange rates for multi-currency accounting. Rates are effective-date based.';
COMMENT ON FUNCTION public.get_exchange_rate IS 'Looks up the most recent exchange rate on or before a given date. Returns NULL if no rate exists.';
