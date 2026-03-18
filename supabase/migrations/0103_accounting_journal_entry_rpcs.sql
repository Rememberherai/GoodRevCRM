-- Migration 0103: Transactional journal entry RPCs
-- Makes journal entry create/update atomic across header and lines.

CREATE OR REPLACE FUNCTION public.create_journal_entry(
    p_company_id UUID,
    p_entry_date DATE,
    p_memo TEXT DEFAULT NULL,
    p_reference TEXT DEFAULT NULL,
    p_source_type TEXT DEFAULT 'manual',
    p_source_id UUID DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_lines JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT public.has_accounting_role(p_company_id, 'member') THEN
        RAISE EXCEPTION 'Insufficient permissions to create journal entries';
    END IF;

    IF jsonb_typeof(p_lines) != 'array' THEN
        RAISE EXCEPTION 'Journal entry lines must be an array';
    END IF;

    IF jsonb_array_length(p_lines) < 2 THEN
        RAISE EXCEPTION 'At least 2 lines are required';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_lines) AS line
        LEFT JOIN public.chart_of_accounts coa
            ON coa.id = (line->>'account_id')::UUID
            AND coa.company_id = p_company_id
            AND coa.is_active = true
            AND coa.deleted_at IS NULL
        WHERE NULLIF(line->>'account_id', '') IS NULL OR coa.id IS NULL
    ) THEN
        RAISE EXCEPTION 'One or more accounts are invalid for this company';
    END IF;

    v_entry_number := public.allocate_je_number(p_company_id);

    INSERT INTO public.journal_entries (
        company_id,
        entry_number,
        entry_date,
        memo,
        reference,
        source_type,
        source_id,
        project_id,
        created_by
    )
    VALUES (
        p_company_id,
        v_entry_number,
        p_entry_date,
        p_memo,
        p_reference,
        p_source_type,
        p_source_id,
        p_project_id,
        auth.uid()
    )
    RETURNING id INTO v_entry_id;

    INSERT INTO public.journal_entry_lines (
        journal_entry_id,
        account_id,
        description,
        debit,
        credit,
        currency,
        exchange_rate,
        organization_id
    )
    SELECT
        v_entry_id,
        (line->>'account_id')::UUID,
        NULLIF(line->>'description', ''),
        COALESCE((line->>'debit')::DECIMAL(15,2), 0),
        COALESCE((line->>'credit')::DECIMAL(15,2), 0),
        COALESCE(NULLIF(line->>'currency', ''), 'USD'),
        COALESCE((line->>'exchange_rate')::DECIMAL(15,6), 1.0),
        CASE
            WHEN NULLIF(line->>'organization_id', '') IS NULL THEN NULL
            ELSE (line->>'organization_id')::UUID
        END
    FROM jsonb_array_elements(p_lines) AS line;

    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE OR REPLACE FUNCTION public.update_draft_journal_entry(
    p_entry_id UUID,
    p_patch JSONB DEFAULT '{}'::JSONB,
    p_lines JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_entry RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT *
    INTO v_entry
    FROM public.journal_entries
    WHERE id = p_entry_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF v_entry IS NULL THEN
        RAISE EXCEPTION 'Journal entry not found: %', p_entry_id;
    END IF;

    IF v_entry.status != 'draft' THEN
        RAISE EXCEPTION 'Can only edit draft journal entries';
    END IF;

    IF NOT public.has_accounting_role(v_entry.company_id, 'member') THEN
        RAISE EXCEPTION 'Insufficient permissions to update journal entries';
    END IF;

    UPDATE public.journal_entries
    SET
        entry_date = CASE
            WHEN p_patch ? 'entry_date' THEN (p_patch->>'entry_date')::DATE
            ELSE entry_date
        END,
        memo = CASE
            WHEN p_patch ? 'memo' THEN p_patch->>'memo'
            ELSE memo
        END,
        reference = CASE
            WHEN p_patch ? 'reference' THEN p_patch->>'reference'
            ELSE reference
        END,
        project_id = CASE
            WHEN p_patch ? 'project_id' THEN (p_patch->>'project_id')::UUID
            ELSE project_id
        END
    WHERE id = p_entry_id;

    IF p_lines IS NOT NULL THEN
        IF jsonb_typeof(p_lines) != 'array' THEN
            RAISE EXCEPTION 'Journal entry lines must be an array';
        END IF;

        IF jsonb_array_length(p_lines) < 2 THEN
            RAISE EXCEPTION 'At least 2 lines are required';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM jsonb_array_elements(p_lines) AS line
            LEFT JOIN public.chart_of_accounts coa
                ON coa.id = (line->>'account_id')::UUID
                AND coa.company_id = v_entry.company_id
                AND coa.is_active = true
                AND coa.deleted_at IS NULL
            WHERE NULLIF(line->>'account_id', '') IS NULL OR coa.id IS NULL
        ) THEN
            RAISE EXCEPTION 'One or more accounts are invalid for this company';
        END IF;

        DELETE FROM public.journal_entry_lines
        WHERE journal_entry_id = p_entry_id;

        INSERT INTO public.journal_entry_lines (
            journal_entry_id,
            account_id,
            description,
            debit,
            credit,
            currency,
            exchange_rate,
            organization_id
        )
        SELECT
            p_entry_id,
            (line->>'account_id')::UUID,
            NULLIF(line->>'description', ''),
            COALESCE((line->>'debit')::DECIMAL(15,2), 0),
            COALESCE((line->>'credit')::DECIMAL(15,2), 0),
            COALESCE(NULLIF(line->>'currency', ''), 'USD'),
            COALESCE((line->>'exchange_rate')::DECIMAL(15,6), 1.0),
            CASE
                WHEN NULLIF(line->>'organization_id', '') IS NULL THEN NULL
                ELSE (line->>'organization_id')::UUID
            END
        FROM jsonb_array_elements(p_lines) AS line;
    END IF;

    RETURN p_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

COMMENT ON FUNCTION public.create_journal_entry IS 'Creates a draft journal entry and its lines atomically.';
COMMENT ON FUNCTION public.update_draft_journal_entry IS 'Updates a draft journal entry and optionally replaces its lines atomically.';
