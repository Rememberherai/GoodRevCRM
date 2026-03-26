import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { parseSignInSheet, matchParsedNames } from '@/lib/events/scan-attendance';
import { checkRateLimit } from '@/lib/calendar/service';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'update');

    const { data: event } = await supabase
      .from('events').select('id').eq('id', id).eq('project_id', project.id).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const limit = await checkRateLimit(`scan:${id}`, 10, 1440);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Scan limit reached for this event today' }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid image type. Allowed: JPEG, PNG, WebP, GIF' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large. Maximum 10MB.' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    const scannedEntries = await parseSignInSheet(project.id, base64, file.type);

    if (scannedEntries.length === 0) {
      return NextResponse.json({ parsed_names: [], message: 'No names could be extracted from the image' });
    }

    // Fuzzy match against project people (using name + email + phone)
    const matchedNames = await matchParsedNames(scannedEntries, project.id);

    return NextResponse.json({ parsed_names: matchedNames });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in POST scan-attendance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
