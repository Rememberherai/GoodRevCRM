-- Allow create_bill to be called from service role (admin client)
-- by accepting an optional p_created_by parameter.
-- When auth.uid() is NULL (service role), use p_created_by instead.

CREATE OR REPLACE FUNCTION public.create_bill(
    p_company_id UUID,
    p_vendor_name TEXT,
    p_bill_date DATE,
    p_due_date DATE,
    p_lines JSONB,
    p_vendor_email TEXT DEFAULT NULL,
    p_vendor_address TEXT DEFAULT NULL,
    p_vendor_phone TEXT DEFAULT NULL,
    p_organization_id UUID DEFAULT NULL,
    p_contact_id UUID DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_currency TEXT DEFAULT 'USD',
    p_exchange_rate DECIMAL DEFAULT 1.0,
    p_notes TEXT DEFAULT NULL,
    p_payment_terms INTEGER DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_bill_id UUID;
    v_bill_number TEXT;
    v_actor_id UUID;
BEGIN
    v_actor_id := COALESCE(auth.uid(), p_created_by);

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Skip role check when called from service role (auth.uid() is NULL)
    IF auth.uid() IS NOT NULL AND NOT public.has_accounting_role(p_company_id, 'member') THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    IF jsonb_typeof(p_lines) != 'array' OR jsonb_array_length(p_lines) < 1 THEN
        RAISE EXCEPTION 'At least 1 line item is required';
    END IF;

    IF p_due_date < p_bill_date THEN
        RAISE EXCEPTION 'Due date cannot be before bill date';
    END IF;

    v_bill_number := public.allocate_bill_number(p_company_id);

    INSERT INTO public.bills (
        company_id, bill_number, vendor_name, vendor_email,
        vendor_address, vendor_phone, organization_id, contact_id,
        project_id, bill_date, due_date, payment_terms,
        currency, exchange_rate, notes, created_by
    )
    VALUES (
        p_company_id, v_bill_number, p_vendor_name, p_vendor_email,
        p_vendor_address, p_vendor_phone, p_organization_id, p_contact_id,
        p_project_id, p_bill_date, p_due_date, p_payment_terms,
        p_currency, p_exchange_rate, p_notes, v_actor_id
    )
    RETURNING id INTO v_bill_id;

    INSERT INTO public.bill_line_items (
        bill_id, description, quantity, unit_price,
        account_id, tax_rate_id, sort_order
    )
    SELECT
        v_bill_id,
        line->>'description',
        COALESCE((line->>'quantity')::DECIMAL(15,4), 1),
        (line->>'unit_price')::DECIMAL(15,4),
        (line->>'account_id')::UUID,
        CASE WHEN NULLIF(line->>'tax_rate_id', '') IS NULL THEN NULL
             ELSE (line->>'tax_rate_id')::UUID END,
        COALESCE((line->>'sort_order')::INTEGER, idx - 1)
    FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS t(line, idx);

    RETURN v_bill_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
