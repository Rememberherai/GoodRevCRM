import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// GET /api/zapier-apps?query=X — Server-side proxy for Zapier app directory
// Needed because zapier.com doesn't set CORS headers for browser requests
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || '';

  const params = new URLSearchParams({ per_page: '20' });
  if (query) params.set('query', query);

  try {
    const res = await fetch(`https://zapier.com/api/v4/apps?${params}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GoodRevCRM/1.0',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Zapier API returned ${res.status}: ${body.slice(0, 200)}`);
      return NextResponse.json({ error: 'Zapier API error', objects: [] }, {
        status: 502,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    const data = await res.json();
    return NextResponse.json({ objects: data.objects || [] }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (err) {
    console.error('Zapier app proxy error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to fetch Zapier apps', objects: [] }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }
}
