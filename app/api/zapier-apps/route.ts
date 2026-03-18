import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/zapier-apps?query=X — Server-side proxy for Zapier app directory
// Needed because zapier.com doesn't set CORS headers for browser requests
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || '';

  const params = new URLSearchParams({ per_page: '20' });
  if (query) params.set('query', query);

  try {
    const res = await fetch(`https://zapier.com/api/v4/apps?${params}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(`Zapier API returned ${res.status}: ${res.statusText}`);
      return NextResponse.json({ error: 'Zapier API error', objects: [] }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({ objects: data.objects || [] });
  } catch (err) {
    console.error('Zapier app proxy error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to fetch Zapier apps', objects: [] }, { status: 502 });
  }
}
