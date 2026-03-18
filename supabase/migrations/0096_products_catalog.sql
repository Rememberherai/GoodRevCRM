-- Migration 096: Products/Services Catalog
-- Opt-in product catalog for quoting on opportunities

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- Product fields
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    default_price DECIMAL(15, 2),
    unit_type TEXT NOT NULL DEFAULT 'unit',
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Metadata
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
CREATE TRIGGER set_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_project_id ON public.products(project_id);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON public.products(deleted_at) WHERE deleted_at IS NULL;

-- SKU uniqueness: optional, but unique within a project when provided
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_project_sku
    ON public.products(project_id, sku)
    WHERE deleted_at IS NULL AND sku IS NOT NULL;

-- RLS Policies

CREATE POLICY "Members can view project products"
    ON public.products
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.is_project_member(project_id)
    );

CREATE POLICY "Members can create products"
    ON public.products
    FOR INSERT
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

CREATE POLICY "Members can update products"
    ON public.products
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND public.has_project_role(project_id, 'member')
    )
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

CREATE POLICY "Members can delete products"
    ON public.products
    FOR DELETE
    USING (
        public.has_project_role(project_id, 'member')
    );

-- Comments
COMMENT ON TABLE public.products IS 'Product/service catalog for quoting';
COMMENT ON COLUMN public.products.sku IS 'Optional stock-keeping unit, unique per project';
COMMENT ON COLUMN public.products.unit_type IS 'Pricing unit: unit, hour, month, license, seat, etc.';
COMMENT ON COLUMN public.products.default_price IS 'Default price copied to line items at creation';
