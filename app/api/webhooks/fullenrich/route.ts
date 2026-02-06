import { NextResponse } from 'next/server';
import { enrichmentWebhookSchema, type EnrichmentRecord } from '@/lib/validators/enrichment';
import type { EnrichmentPerson } from '@/lib/fullenrich/client';
import { createAdminClient } from '@/lib/supabase/admin';

// Verify webhook signature
function verifySignature(payload: string, signature: string | null): boolean {
  const webhookSecret = process.env.FULLENRICH_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('FULLENRICH_WEBHOOK_SECRET not configured');
    return false;
  }

  if (!signature) {
    return false;
  }

  // Use dynamic import for crypto in edge runtime
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

// POST /api/webhooks/fullenrich - Handle enrichment completion webhook
export async function POST(request: Request) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature
    const signature = request.headers.get('x-fullenrich-signature');
    if (!verifySignature(rawBody, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse and validate payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validationResult = enrichmentWebhookSchema.safeParse(payload);
    if (!validationResult.success) {
      console.error('Invalid webhook payload:', validationResult.error.message);
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      );
    }

    const webhookData = validationResult.data;
    const enrichmentId = webhookData.enrichment_id ?? webhookData.id ?? '';
    if (!enrichmentId || enrichmentId.length > 255) {
      return NextResponse.json({ error: 'Missing or invalid enrichment ID' }, { status: 400 });
    }
    const { status, datas: results, cost, error } = webhookData;
    const credits_used = cost?.credits ?? 0;

    console.log('FullEnrich webhook received:', { enrichmentId, status, resultsCount: results?.length });

    // Create admin client (bypasses RLS for webhook processing)
    // Use type assertion for enrichment_jobs (not yet in Database type)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;

    // Find all enrichment jobs with this external job ID
    const { data: jobs, error: fetchError } = await supabase
      .from('enrichment_jobs')
      .select('id, person_id, project_id')
      .eq('external_job_id', enrichmentId)
      .order('created_at', { ascending: true });

    if (fetchError || !jobs || jobs.length === 0) {
      console.error('Enrichment jobs not found for external ID:', enrichmentId.slice(0, 100).replace(/[\n\r]/g, ''));
      return NextResponse.json({ error: 'Jobs not found' }, { status: 404 });
    }

    // Handle failed/canceled/insufficient credits statuses
    if (status === 'CANCELED' || status === 'CREDITS_INSUFFICIENT' || status === 'RATE_LIMIT') {
      const rawErrorMessage = status === 'CREDITS_INSUFFICIENT'
        ? 'Insufficient credits'
        : status === 'RATE_LIMIT'
          ? 'Rate limit exceeded'
          : error ?? 'Enrichment canceled';
      const errorMessage = typeof rawErrorMessage === 'string' ? rawErrorMessage.slice(0, 500) : 'Enrichment failed';

      await supabase
        .from('enrichment_jobs')
        .update({
          status: 'failed',
          error: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('external_job_id', enrichmentId);

      return NextResponse.json({ processed: jobs.length, status: 'failed' });
    }

    // Still processing
    if (status === 'CREATED' || status === 'IN_PROGRESS') {
      return NextResponse.json({ processed: 0, status: 'processing' });
    }

    // Process completed results (status === 'FINISHED')
    if (!results || results.length === 0) {
      await supabase
        .from('enrichment_jobs')
        .update({
          status: 'completed',
          credits_used: credits_used,
          completed_at: new Date().toISOString(),
        })
        .eq('external_job_id', enrichmentId);

      return NextResponse.json({ processed: jobs.length, status: 'completed' });
    }

    // Map results to jobs and update
    const creditsPerJob = credits_used ? Math.ceil(credits_used / jobs.length) : 1;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]!;
      const record = results[i] as EnrichmentRecord | undefined;

      if (!record) {
        // No result for this job
        await supabase
          .from('enrichment_jobs')
          .update({
            status: 'completed',
            credits_used: creditsPerJob,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        continue;
      }

      if (record.error) {
        const truncatedError = typeof record.error === 'string' ? record.error.slice(0, 500) : 'Enrichment failed';
        await supabase
          .from('enrichment_jobs')
          .update({
            status: 'failed',
            error: truncatedError,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        continue;
      }

      // Extract data from FullEnrich v1 format (contact object with phones/emails)
      const contact = record.contact;
      const profile = contact?.profile;

      // Map phones from v1 format (number field) to our format (phone field)
      const allPhones = contact?.phones?.map((p: { number: string; type?: string; status?: string }) => ({
        phone: p.number,
        type: p.type ?? 'mobile',
        status: p.status,
      })) ?? [];

      const allEmails = contact?.emails ?? [];

      // Convert result to EnrichmentPerson format
      const enrichmentResult: EnrichmentPerson = {
        email: contact?.most_probable_email ?? allEmails[0]?.email ?? null,
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
        full_name: profile?.full_name ?? null,
        job_title: profile?.job_title ?? null,
        company_name: profile?.company ?? null,
        company_domain: null,
        linkedin_url: profile?.linkedin_url ?? null,
        phone: contact?.most_probable_phone ?? allPhones[0]?.phone ?? null,
        location: profile?.location ? {
          city: profile.location.city ?? null,
          state: profile.location.state ?? null,
          country: profile.location.country ?? null,
        } : null,
        work_email: allEmails.find((e: { type?: string }) => e.type === 'work')?.email ?? null,
        personal_email: contact?.most_probable_personal_email ??
                        allEmails.find((e: { type?: string }) => e.type === 'personal')?.email ?? null,
        mobile_phone: allPhones.find((p: { type?: string }) => p.type === 'mobile')?.phone ?? null,
        work_phone: allPhones.find((p: { type?: string }) => p.type === 'work')?.phone ?? null,
        confidence_score: null,
        // Include raw arrays for user selection in review modal
        all_emails: allEmails,
        all_phones: allPhones,
      };

      // Update job with results (user will review and apply via modal)
      await supabase
        .from('enrichment_jobs')
        .update({
          status: 'completed',
          result: enrichmentResult,
          credits_used: creditsPerJob,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      // Note: We do NOT auto-apply to person record here
      // User must review and select which fields to apply via the review modal
    }

    return NextResponse.json({
      processed: jobs.length,
      status: 'completed',
      credits_used,
    });
  } catch (error) {
    console.error('Error in POST /api/webhooks/fullenrich:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
