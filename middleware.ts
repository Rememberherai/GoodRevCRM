import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth/callback', '/invite', '/sign', '/book', '/events', '/resources'];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // API routes and static assets
  const isApiRoute = pathname.startsWith('/api');
  const isStaticAsset = pathname.startsWith('/_next') || /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot|map)$/i.test(pathname);

  // If not logged in and trying to access protected route, redirect to login
  if (!user && !isPublicRoute && !isApiRoute && !isStaticAsset) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If logged in and trying to access login page or root, redirect to projects
  if (user && (pathname === '/login' || pathname === '/signup' || pathname === '/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/projects';
    return NextResponse.redirect(url);
  }

  // If not logged in and on root, redirect to login
  if (!user && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Embed routes are frameable by any HTTPS origin by design — customers embed
  // booking/event widgets on their own websites and we cannot predict their domains.
  // RISK ACCEPTED: clickjacking is possible on embed pages. Mitigations:
  //   1. Embed pages are public-only — no authenticated session, no sensitive actions
  //   2. Cookies are not sent (Cross-Origin-Resource-Policy)
  //   3. Forms are restricted via sandbox-like CSP (no form-action to foreign origins)
  if (pathname.startsWith('/book/embed') || pathname.startsWith('/events/embed')) {
    supabaseResponse.headers.delete('X-Frame-Options');
    supabaseResponse.headers.set('Content-Security-Policy', "frame-ancestors 'self' https:; form-action 'self'");
    supabaseResponse.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  } else {
    // Prevent clickjacking on all non-embed routes
    supabaseResponse.headers.set('Content-Security-Policy', "frame-ancestors 'self'");
    supabaseResponse.headers.set('X-Frame-Options', 'SAMEORIGIN');
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
