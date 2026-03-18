import { NextResponse } from 'next/server';

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
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ objects: [] }, { status: 200 });
    }

    const data = await res.json();
    return NextResponse.json({ objects: data.objects || [] });
  } catch {
    return NextResponse.json({ objects: [] }, { status: 200 });
  }
}
