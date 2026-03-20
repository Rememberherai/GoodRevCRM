import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPublicAppUrl } from '@/lib/url/get-public-url';
import { exchangeQuickBooksCode } from '@/lib/assistant/quickbooks';
import { verifyQuickBooksOAuthState } from '@/lib/assistant/quickbooks-oauth-state';
import { setProjectSecret } from '@/lib/secrets';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError, requireProjectRole } from '@/lib/projects/permissions';

export async function GET(request: Request) {
  const origin = getPublicAppUrl(request);
  const fallbackRedirect = `${origin}/projects`;

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const realmId = searchParams.get('realmId');
    const oauthError = searchParams.get('error');

    if (oauthError) {
      return NextResponse.redirect(`${fallbackRedirect}?quickbooks_error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !stateParam || !realmId) {
      return NextResponse.redirect(`${fallbackRedirect}?quickbooks_error=missing_params`);
    }

    const state = verifyQuickBooksOAuthState(stateParam);
    if (!state || state.type !== 'quickbooks') {
      return NextResponse.redirect(`${fallbackRedirect}?quickbooks_error=invalid_state`);
    }

    if (Date.now() - state.timestamp > 10 * 60 * 1000) {
      return NextResponse.redirect(`${fallbackRedirect}?quickbooks_error=state_expired`);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== state.user_id) {
      return NextResponse.redirect(`${origin}/login`);
    }

    const { data: project } = await supabase
      .from('projects')
      .select('slug, project_type')
      .eq('id', state.project_id)
      .single();

    if (!project) {
      return NextResponse.redirect(`${fallbackRedirect}?quickbooks_error=project_not_found`);
    }

    if (project.project_type === 'community') {
      await requireCommunityPermission(supabase, user.id, state.project_id, 'settings', 'update');
    } else {
      await requireProjectRole(supabase, user.id, state.project_id, 'admin');
    }

    const tokens = await exchangeQuickBooksCode({
      code,
      realmId,
      requestOrigin: origin,
    });

    await Promise.all([
      setProjectSecret(state.project_id, 'quickbooks_access_token', tokens.accessToken, user.id),
      setProjectSecret(state.project_id, 'quickbooks_refresh_token', tokens.refreshToken, user.id),
      setProjectSecret(state.project_id, 'quickbooks_realm_id', tokens.realmId, user.id),
      setProjectSecret(state.project_id, 'quickbooks_token_expires_at', tokens.expiresAt, user.id),
    ]);

    const redirectSlug = project?.slug ? `/projects/${project.slug}/settings?quickbooks=connected` : '/projects?quickbooks=connected';
    return NextResponse.redirect(`${origin}${redirectSlug}`);
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.redirect(`${fallbackRedirect}?quickbooks_error=forbidden`);
    }

    console.error('[QUICKBOOKS_CALLBACK] Error completing OAuth flow:', error);
    return NextResponse.redirect(`${fallbackRedirect}?quickbooks_error=callback_failed`);
  }
}
