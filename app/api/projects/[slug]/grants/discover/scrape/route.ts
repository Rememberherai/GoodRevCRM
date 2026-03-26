import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { getProjectOpenRouterClient } from '@/lib/openrouter/client';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// POST /api/projects/[slug]/grants/discover/scrape
// Scrapes a URL and extracts grant details using AI
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'create');

    const body = await request.json();
    const { url } = body as { url: string };

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL and block SSRF (private/internal addresses)
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Only HTTP/HTTPS URLs are allowed' }, { status: 400 });
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const blockedPatterns = [
      /^localhost$/i,
      /^127\.\d+\.\d+\.\d+$/,
      /^10\.\d+\.\d+\.\d+$/,
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
      /^192\.168\.\d+\.\d+$/,
      /^0\.0\.0\.0$/,
      /^169\.254\.\d+\.\d+$/, // link-local
      /^\[::1?\]$/,
      /\.local$/,
      /\.internal$/,
    ];
    if (blockedPatterns.some(p => p.test(hostname))) {
      return NextResponse.json({ error: 'URL targets a restricted address' }, { status: 400 });
    }

    // Fetch the page
    let pageContent: string;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GoodRevCRM/1.0; grant-discovery)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return NextResponse.json({ error: `Failed to fetch URL: ${response.status}` }, { status: 422 });
      }

      const html = await response.text();
      // Strip HTML tags for cleaner AI input, keep text content
      pageContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 15000); // Limit to 15K chars
    } catch (err) {
      return NextResponse.json(
        { error: `Could not fetch page: ${err instanceof Error ? err.message : 'Unknown error'}` },
        { status: 422 }
      );
    }

    // Use AI to extract grant information
    const openrouter = await getProjectOpenRouterClient(project.id);

    const result = await openrouter.chat(
      [
        {
          role: 'user',
          content: `Extract grant/funding opportunity information from this web page content.

Page URL: ${url}

Page content:
${pageContent}

Extract the following fields as a JSON object:
- name: The grant or funding opportunity name/title
- funder_name: The organization offering the funding
- amount: The grant amount or range (as a string, e.g., "$50,000" or "$10,000 - $100,000")
- amount_value: Numeric value of the grant amount (use the maximum if a range, null if not specified)
- deadline: Application deadline (as YYYY-MM-DD if possible, otherwise the date string as found)
- description: Brief summary of the opportunity (2-3 sentences)
- eligibility: Who can apply
- focus_areas: Key focus areas or program priorities

If certain fields cannot be determined from the page, set them to null.
Return ONLY a JSON object, no markdown or other text.`,
        },
      ],
      {
        model: 'google/gemini-2.5-flash',
        responseFormat: 'json_object',
        maxTokens: 2048,
      }
    );

    let extracted = {};
    try {
      extracted = JSON.parse(result.choices[0]?.message.content ?? '{}');
    } catch {
      extracted = {};
    }

    return NextResponse.json({
      extracted,
      source_url: url,
    });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /grants/discover/scrape:', error);
    return NextResponse.json({ error: 'Scraping failed' }, { status: 500 });
  }
}
