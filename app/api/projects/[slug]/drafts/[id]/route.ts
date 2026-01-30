import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateDraftSchema } from '@/lib/validators/email-template';

// GET /api/projects/[slug]/drafts/[id] - Get draft details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get draft (only user's own)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: draft, error: draftError } = await (supabase as any)
      .from('email_drafts')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (draftError || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json(draft);
  } catch (error) {
    console.error('Error fetching draft:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/drafts/[id] - Update draft
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check draft exists and belongs to user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingDraft } = await (supabase as any)
      .from('email_drafts')
      .select('status')
      .eq('id', id)
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!existingDraft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Cannot update sent drafts
    if (existingDraft.status === 'sent') {
      return NextResponse.json(
        { error: 'Cannot update a sent email' },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const validationResult = updateDraftSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // If scheduling, update status
    const updateData = { ...validationResult.data };
    if (updateData.scheduled_at && updateData.status !== 'scheduled') {
      updateData.status = 'scheduled';
    } else if (updateData.scheduled_at === null && existingDraft.status === 'scheduled') {
      updateData.status = 'draft';
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: draft, error: updateError } = await (supabase as any)
      .from('email_drafts')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating draft:', updateError);
      return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
    }

    return NextResponse.json(draft);
  } catch (error) {
    console.error('Error updating draft:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/drafts/[id] - Delete draft
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('email_drafts')
      .delete()
      .eq('id', id)
      .eq('project_id', project.id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting draft:', deleteError);
      return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting draft:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/drafts/[id] - Send draft
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get draft
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: draft, error: draftError } = await (supabase as any)
      .from('email_drafts')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (draftError || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Check draft can be sent
    if (!['draft', 'scheduled'].includes(draft.status)) {
      return NextResponse.json(
        { error: 'This draft cannot be sent' },
        { status: 400 }
      );
    }

    // Mark as sending
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('email_drafts')
      .update({ status: 'sending' })
      .eq('id', id);

    // In a real implementation, this would send via Gmail API or similar
    // For now, we'll simulate sending by marking as sent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sentDraft, error: sendError } = await (supabase as any)
      .from('email_drafts')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (sendError) {
      // Mark as failed if sending fails
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('email_drafts')
        .update({
          status: 'failed',
          error_message: sendError.message,
        })
        .eq('id', id);

      return NextResponse.json(
        { error: 'Failed to send email', details: sendError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(sentDraft);
  } catch (error) {
    console.error('Error sending draft:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
