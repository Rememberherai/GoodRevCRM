import { NextResponse } from 'next/server';
import { enrichmentWebhookSchema } from '@/lib/validators/enrichment';
import type { EnrichmentPerson } from '@/lib/fullenrich/client';
import { createAdminClient } from '@/lib/supabase/admin';

// Verify webhook signature
function verifySignature(payload: string, signature: string | null): boolean {
  const webhookSecret = process.env.FULLENRICH_WEBHOOK_SECRET;

  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FULLENRICH_WEBHOOK_SECRET required for webhook verification in production');
    }
    console.warn('FULLENRICH_WEBHOOK_SECRET not set — skipping webhook verification (dev only)');
    return true;
  }

  if (!signature) {
    console.error('No signature provided in webhook request');
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
  if (sigBuf.length !== expBuf.length) {
    console.error('Webhook signature length mismatch');
    return false;
  }
  const isValid = crypto.timingSafeEqual(sigBuf, expBuf);
  if (!isValid) {
    console.error('Webhook signature verification failed');
  }
  return isValid;
}

/**
 * Transform a v2 enrichment record into our internal EnrichmentPerson format.
 * Shared between webhook handler and polling logic.
 */
function transformV2RecordToEnrichmentPerson(record: {
  contact_info?: {
    most_probable_work_email?: { email: string; status?: string } | null;
    most_probable_personal_email?: { email: string; status?: string } | null;
    most_probable_phone?: { number: string; region?: string } | null;
    work_emails?: { email: string; status?: string }[];
    personal_emails?: { email: string; status?: string }[];
    phones?: { number: string; region?: string }[];
  } | null;
  profile?: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    location?: { country?: string | null; city?: string | null; region?: string | null } | null;
    social_profiles?: { linkedin?: { url?: string } | null } | null;
    employment?: { current?: { title?: string; company?: { name?: string; domain?: string } | null } | null } | null;
  } | null;
  custom?: Record<string, unknown>;
}): EnrichmentPerson {
  const contactInfo = record.contact_info;
  const profile = record.profile;

  const allPhones = contactInfo?.phones?.map((p) => ({
    phone: p.number,
    type: 'mobile' as string,
    status: undefined as string | undefined,
    region: p.region,
  })) ?? [];

  const workEmails = (contactInfo?.work_emails ?? []).map((e) => ({
    email: e.email,
    status: e.status,
    type: 'work' as string,
  }));
  const personalEmails = (contactInfo?.personal_emails ?? []).map((e) => ({
    email: e.email,
    status: e.status,
    type: 'personal' as string,
  }));
  const allEmails = [...workEmails, ...personalEmails];

  return {
    email: contactInfo?.most_probable_work_email?.email ?? allEmails[0]?.email ?? null,
    first_name: profile?.first_name ?? null,
    last_name: profile?.last_name ?? null,
    full_name: profile?.full_name ?? null,
    job_title: profile?.employment?.current?.title ?? null,
    company_name: profile?.employment?.current?.company?.name ?? null,
    company_domain: profile?.employment?.current?.company?.domain ?? null,
    linkedin_url: profile?.social_profiles?.linkedin?.url ?? null,
    phone: contactInfo?.most_probable_phone?.number ?? allPhones[0]?.phone ?? null,
    location: profile?.location ? {
      city: profile.location.city ?? null,
      state: profile.location.region ?? null,
      country: profile.location.country ?? null,
    } : null,
    work_email: contactInfo?.most_probable_work_email?.email ?? workEmails[0]?.email ?? null,
    personal_email: contactInfo?.most_probable_personal_email?.email ?? personalEmails[0]?.email ?? null,
    mobile_phone: allPhones[0]?.phone ?? null,
    work_phone: null,
    confidence_score: null,
    all_emails: allEmails,
    all_phones: allPhones,
  };
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

    const status = webhookData.status;
    const results = webhookData.data; // v2 uses "data" not "datas"
    const cost = webhookData.cost;
    const error = webhookData.error;
    const credits_used = cost?.credits ?? 0;

    console.log('FullEnrich v2 webhook received:', { enrichmentId, status, resultsCount: results?.length });

    // Create admin client (bypasses RLS for webhook processing)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;

    // Find all enrichment jobs with this external job ID
    const { data: jobs, error: fetchError } = await supabase
      .from('enrichment_jobs')
      .select('id, person_id, project_id, created_by')
      .eq('external_job_id', enrichmentId)
      .order('created_at', { ascending: true });

    if (fetchError || !jobs || jobs.length === 0) {
      console.error('Enrichment jobs not found for external ID:', enrichmentId.slice(0, 100).replace(/[\n\r]/g, ''));
      return NextResponse.json({ error: 'Jobs not found' }, { status: 404 });
    }

    // Fetch person names and project slug for notifications
    const personIds = [...new Set(jobs.map((j: { person_id: string }) => j.person_id))];
    const { data: personRows } = await supabase
      .from('people')
      .select('id, first_name, last_name')
      .in('id', personIds);
    const personNameMap = new Map(
      (personRows ?? []).map((p: { id: string; first_name: string | null; last_name: string | null }) =>
        [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown']
      )
    );
    const projectId = jobs[0]?.project_id;
    const { data: projectRow } = await supabase
      .from('projects')
      .select('slug')
      .eq('id', projectId)
      .single();
    const projectSlug = projectRow?.slug ?? '';

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
      const record = results[i];

      if (!record) {
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

      // Transform v2 record to our EnrichmentPerson format
      const enrichmentResult = transformV2RecordToEnrichmentPerson(record);

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

      // Create notification for the user
      const hasData = !!(enrichmentResult.email || enrichmentResult.phone ||
        (enrichmentResult.all_emails?.length ?? 0) > 0 || (enrichmentResult.all_phones?.length ?? 0) > 0);
      const pName = personNameMap.get(job.person_id) ?? 'Unknown';
      try {
        await supabase.from('notifications').insert({
          user_id: job.created_by,
          type: 'custom',
          title: hasData ? 'Enrichment Complete' : 'Enrichment Complete — No Data Found',
          message: hasData
            ? `New data found for ${pName}. Click to review and apply.`
            : `No new data was found for ${pName}.`,
          priority: 'normal',
          entity_type: 'person',
          entity_id: job.person_id,
          project_id: projectId,
          action_url: `/projects/${projectSlug}/people/${job.person_id}`,
          data: { personId: job.person_id, projectSlug },
        });
      } catch (notifErr) {
        console.error('Error creating enrichment notification:', notifErr);
      }
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
