import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BUCKET = 'bug-screenshots';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const description = formData.get('description');
    const pageUrl = formData.get('page_url');
    const projectId = formData.get('project_id');
    const screenshot = formData.get('screenshot');

    if (typeof description !== 'string' || !description.trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    if (typeof pageUrl !== 'string' || !pageUrl.trim()) {
      return NextResponse.json({ error: 'Page URL is required' }, { status: 400 });
    }

    let screenshotPath: string | null = null;

    if (screenshot instanceof File && screenshot.size > 0) {
      if (!ACCEPTED_TYPES.has(screenshot.type)) {
        return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are supported' }, { status: 400 });
      }

      if (screenshot.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: 'Screenshot must be under 10MB' }, { status: 400 });
      }

      const bytes = new Uint8Array(await screenshot.arrayBuffer());
      const ext = screenshot.type.split('/')[1] ?? 'png';
      screenshotPath = `${user.id}/${Date.now()}_screenshot.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(screenshotPath, bytes, {
          contentType: screenshot.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('[BUG_REPORT] Failed to upload screenshot:', uploadError);
        return NextResponse.json({ error: 'Failed to upload screenshot' }, { status: 500 });
      }
    }

    const userAgent = request.headers.get('user-agent') ?? null;

    const { data: bugReport, error } = await supabase
      .from('bug_reports')
      .insert({
        user_id: user.id,
        project_id: typeof projectId === 'string' && projectId ? projectId : null,
        description: description.trim(),
        page_url: pageUrl.trim(),
        screenshot_path: screenshotPath,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (error) {
      console.error('[BUG_REPORT] Failed to create bug report:', error);
      return NextResponse.json({ error: 'Failed to create bug report' }, { status: 500 });
    }

    return NextResponse.json(bugReport);
  } catch (error) {
    console.error('[BUG_REPORT] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
