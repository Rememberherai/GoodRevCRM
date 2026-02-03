import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { logActivitySchema } from '@/lib/validators/activity';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// POST /api/projects/[slug]/activity/log - Manually log a CRM activity
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = logActivitySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const {
      activity_type,
      person_id,
      organization_id,
      opportunity_id,
      rfp_id,
      subject,
      notes,
      outcome,
      direction,
      duration_minutes,
      follow_up_date,
      follow_up_title,
    } = validationResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for') ?? null;
    const userAgent = request.headers.get('user-agent') ?? null;

    // Insert the activity log entry
    const { data: activity, error: activityError } = await supabaseAny
      .from('activity_log')
      .insert({
        project_id: project.id,
        user_id: user.id,
        entity_type: 'person',
        entity_id: person_id,
        action: 'logged',
        activity_type,
        person_id,
        organization_id: organization_id ?? null,
        opportunity_id: opportunity_id ?? null,
        rfp_id: rfp_id ?? null,
        subject,
        notes: notes ?? null,
        outcome: outcome ?? null,
        direction: direction ?? null,
        duration_minutes: duration_minutes ?? null,
        follow_up_date: follow_up_date ?? null,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (activityError) {
      console.error('Error logging activity:', activityError);
      return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 });
    }

    // If follow_up_date is provided, create a follow-up task
    if (follow_up_date) {
      const taskTitle = follow_up_title || `Follow up: ${subject}`;

      const { data: task, error: taskError } = await supabaseAny
        .from('tasks')
        .insert({
          project_id: project.id,
          title: taskTitle,
          status: 'pending',
          priority: 'medium',
          due_date: follow_up_date,
          person_id: person_id ?? null,
          organization_id: organization_id ?? null,
          opportunity_id: opportunity_id ?? null,
          rfp_id: rfp_id ?? null,
          assigned_to: user.id,
          created_by: user.id,
          source_activity_id: activity.id,
        })
        .select()
        .single();

      if (taskError) {
        console.error('Error creating follow-up task:', taskError);
        return NextResponse.json({ error: 'Failed to create follow-up task' }, { status: 500 });
      }

      // Update the activity with the follow-up task ID
      const { error: updateError } = await supabaseAny
        .from('activity_log')
        .update({ follow_up_task_id: task.id })
        .eq('id', activity.id);

      if (updateError) {
        console.error('Error linking follow-up task to activity:', updateError);
      }
    }

    // Fetch the final activity with relations
    const { data: finalActivity, error: fetchError } = await supabaseAny
      .from('activity_log')
      .select(`
        *,
        user:users!activity_log_user_id_fkey(id, full_name, email, avatar_url),
        person:people!activity_log_person_id_fkey(id, first_name, last_name, email),
        organization:organizations!activity_log_organization_id_fkey(id, name),
        follow_up_task:tasks!activity_log_follow_up_task_id_fkey(id, title, status, due_date)
      `)
      .eq('id', activity.id)
      .single();

    if (fetchError) {
      console.error('Error fetching activity with relations:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
    }

    return NextResponse.json(finalActivity, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/activity/log:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
