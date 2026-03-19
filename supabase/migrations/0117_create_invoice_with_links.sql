-- Phase 6 follow-up: create invoices atomically with CRM source links

CREATE OR REPLACE FUNCTION public.create_invoice_with_links(
    p_company_id UUID,
    p_customer_name TEXT,
    p_invoice_date DATE,
    p_due_date DATE,
    p_lines JSONB,
    p_customer_email TEXT DEFAULT NULL,
    p_customer_address TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL,
    p_organization_id UUID DEFAULT NULL,
    p_contact_id UUID DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_currency TEXT DEFAULT 'USD',
    p_exchange_rate DECIMAL DEFAULT 1.0,
    p_notes TEXT DEFAULT NULL,
    p_footer TEXT DEFAULT NULL,
    p_payment_terms INTEGER DEFAULT NULL,
    p_opportunity_id UUID DEFAULT NULL,
    p_contract_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_invoice_id UUID;
BEGIN
    v_invoice_id := public.create_invoice(
        p_company_id := p_company_id,
        p_customer_name := p_customer_name,
        p_invoice_date := p_invoice_date,
        p_due_date := p_due_date,
        p_lines := p_lines,
        p_customer_email := p_customer_email,
        p_customer_address := p_customer_address,
        p_customer_phone := p_customer_phone,
        p_organization_id := p_organization_id,
        p_contact_id := p_contact_id,
        p_project_id := p_project_id,
        p_currency := p_currency,
        p_exchange_rate := p_exchange_rate,
        p_notes := p_notes,
        p_footer := p_footer,
        p_payment_terms := p_payment_terms
    );

    UPDATE public.invoices
    SET opportunity_id = COALESCE(p_opportunity_id, opportunity_id),
        contract_id = COALESCE(p_contract_id, contract_id)
    WHERE id = v_invoice_id
      AND company_id = p_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Failed to link invoice to CRM source';
    END IF;

    RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
