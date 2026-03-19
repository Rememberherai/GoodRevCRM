import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function readProjectFile(...segments: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
}

describe('Quote Regression Guards', () => {
  it('keeps bulk line item replacement atomic in the DB layer', () => {
    const migration = readProjectFile('supabase', 'migrations', '0128_quotes_and_line_items.sql');
    const service = readProjectFile('lib', 'quotes', 'service.ts');

    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.replace_quote_line_items(');
    expect(migration).toContain("REVOKE EXECUTE ON FUNCTION public.replace_quote_line_items(uuid, uuid, jsonb)");
    expect(service).toContain("rpc('replace_quote_line_items'");
  });

  it('keeps closed-opportunity guards on quote and line-item delete paths', () => {
    const migration = readProjectFile('supabase', 'migrations', '0128_quotes_and_line_items.sql');

    expect(migration).toContain('BEFORE INSERT OR UPDATE OR DELETE ON public.quotes');
    expect(migration).toContain('BEFORE INSERT OR UPDATE OR DELETE ON public.quote_line_items');
    expect(migration).toContain("RAISE EXCEPTION 'Cannot modify quotes on a closed opportunity'");
    expect(migration).toContain("RAISE EXCEPTION 'Cannot modify line items on a closed opportunity'");
  });

  it('keeps oppId scoping on nested line-item routes', () => {
    const route = readProjectFile(
      'app',
      'api',
      'projects',
      '[slug]',
      'opportunities',
      '[id]',
      'quotes',
      '[quoteId]',
      'line-items',
      '[itemId]',
      'route.ts'
    );

    expect(route).toContain('const { slug, id, quoteId, itemId } = await context.params;');
    expect(route).toContain('quoteId, itemId, body, id');
    expect(route).toContain('quoteId, itemId, id');
  });

  it('keeps route-level quote/product RBAC checks in place', () => {
    const quotesRoute = readProjectFile(
      'app',
      'api',
      'projects',
      '[slug]',
      'opportunities',
      '[id]',
      'quotes',
      'route.ts'
    );
    const setPrimaryRoute = readProjectFile(
      'app',
      'api',
      'projects',
      '[slug]',
      'opportunities',
      '[id]',
      'quotes',
      '[quoteId]',
      'set-primary',
      'route.ts'
    );
    const productsRoute = readProjectFile(
      'app',
      'api',
      'projects',
      '[slug]',
      'products',
      'route.ts'
    );

    expect(quotesRoute).toContain("await requireProjectRole(supabase, user.id, project.id, 'viewer');");
    expect(quotesRoute).toContain("await requireProjectRole(supabase, user.id, project.id, 'member');");
    expect(setPrimaryRoute).toContain("await requireProjectRole(supabase, user.id, project.id, 'member');");
    expect(productsRoute).toContain("await requireProjectRole(supabase, user.id, project.id, 'viewer');");
    expect(productsRoute).toContain("await requireProjectRole(supabase, user.id, project.id, 'member');");
  });

  it('keeps product settings UI role-gated for viewer users', () => {
    const panel = readProjectFile('components', 'settings', 'products-catalog-panel.tsx');
    const settingsPage = readProjectFile(
      'app',
      '(dashboard)',
      'projects',
      '[slug]',
      'settings',
      'page.tsx'
    );

    expect(panel).toContain('currentUserRole: ProjectRole;');
    expect(panel).toContain("const canManageProducts = currentUserRole !== 'viewer';");
    expect(settingsPage).toContain('<ProductsCatalogPanel slug={slug} currentUserRole={currentUserRole} />');
  });

  it('keeps opportunity detail refreshing both quote list and opportunity data after quote mutations', () => {
    const detailPage = readProjectFile(
      'app',
      '(dashboard)',
      'projects',
      '[slug]',
      'opportunities',
      '[id]',
      'opportunity-detail-client.tsx'
    );

    expect(detailPage).toContain('Promise.all([quotesHook.reload(), refresh()])');
  });

  it('keeps line-item edits refreshing parent quote surfaces', () => {
    const quoteDetail = readProjectFile('components', 'quotes', 'quote-detail.tsx');

    expect(quoteDetail).toContain('await onQuoteChanged();');
  });

  it('keeps chat quote line-item tools scoped through the quote service layer', () => {
    const toolRegistry = readProjectFile('lib', 'chat', 'tool-registry.ts');

    expect(toolRegistry).toContain('const lineItem = await addQuoteLineItemService(');
    expect(toolRegistry).toContain('const lineItem = await updateQuoteLineItemService(');
    expect(toolRegistry).toContain('await deleteQuoteLineItemService(');
    expect(toolRegistry).toContain("quote_id: z.string().uuid().describe('Quote ID')");
  });

  it('prevents rejecting quotes that are already rejected or expired', () => {
    const service = readProjectFile('lib', 'quotes', 'service.ts');

    expect(service).toContain("if (prevStatus === 'rejected' || prevStatus === 'expired')");
    expect(service).toContain('Cannot reject a ${prevStatus} quote');
  });
});
