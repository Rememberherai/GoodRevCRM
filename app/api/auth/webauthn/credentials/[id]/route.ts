import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// DELETE /api/auth/webauthn/credentials/[id]
// Deletes a specific passkey credential owned by the authenticated user.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const admin = createAdminClient();

    // Verify ownership before deleting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: credential, error: fetchError } = await (admin as any)
      .from('webauthn_credentials')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !credential) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    if (credential.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (admin as any)
      .from('webauthn_credentials')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting credential:', deleteError);
      return NextResponse.json({ error: 'Failed to delete credential' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/auth/webauthn/credentials/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
