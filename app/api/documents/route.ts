import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createContractDocumentSchema } from '@/lib/validators/contract';
import { createDocument, listDocuments } from '@/lib/contracts/service';
import { emitAutomationEvent } from '@/lib/automations/engine';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10), 1), 200);
  const search = searchParams.get('search') || undefined;
  const status = searchParams.get('status') || undefined;
  const sortBy = searchParams.get('sort_by') ?? 'created_at';
  const sortOrder = (searchParams.get('sort_order') ?? 'desc') as 'asc' | 'desc';

  // Source filter: 'standalone' | project UUID | undefined (all)
  const source = searchParams.get('source');
  let projectId: string | null | undefined;
  if (source === 'standalone') {
    projectId = null;
  } else if (source) {
    projectId = source;
  }

  try {
    const result = await listDocuments({
      supabase,
      userId: user.id,
      projectId,
      status,
      search,
      sortBy,
      sortOrder,
      page,
      pageSize: limit,
    });

    return NextResponse.json({
      documents: result.documents,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const result = createContractDocumentSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const document = await createDocument({
      supabase,
      userId: user.id,
      projectId: null, // Standalone
      title: result.data.title,
      description: result.data.description ?? undefined,
      signingOrderType: result.data.signing_order_type as 'sequential' | 'parallel' | undefined,
      filePath: result.data.original_file_path,
      originalFileName: result.data.original_file_name,
      originalFileHash: result.data.original_file_hash ?? undefined,
      pageCount: result.data.page_count ?? 1,
    });

    // Standalone docs have no project_id — skip automation events
    if (document.project_id) {
      emitAutomationEvent({
        projectId: document.project_id,
        triggerType: 'entity.created',
        entityType: 'document' as never,
        entityId: document.id,
        data: document as unknown as Record<string, unknown>,
      });
    }

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create document' }, { status: 500 });
  }
}
