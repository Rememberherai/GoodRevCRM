import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { enrichmentWebhookSchema, type EnrichmentRecord } from '@/lib/validators/enrichment';
import { mapEnrichmentToPerson, type EnrichmentPerson } from '@/lib/fullenrich/client';

// Create admin client for webhook processing (bypasses RLS)
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Verify webhook signature
function verifySignature(payload: string, signature: string | null): boolean {
  const webhookSecret = process.env.FULLENRICH_WEBHOOK_SECRET;

  // If no secret configured, skip verification (not recommended for production)
  if (!webhookSecret) {
    console.warn('FULLENRICH_WEBHOOK_SECRET not configured, skipping signature verification');
    return true;
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

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
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
      console.error('Invalid webhook payload:', validationResult.error);
      return NextResponse.json(
        { error: 'Invalid payload', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const webhookData = validationResult.data;
    const { id: enrichmentId, status, data: results, cost, error } = webhookData;
    const credits_used = cost?.credits ?? 0;

    console.log('FullEnrich webhook received:', { enrichmentId, status, resultsCount: results?.length });

    // Create admin client (bypasses RLS for webhook processing)
    const supabase = createAdminClient();

    // Find all enrichment jobs with this external job ID
    const { data: jobs, error: fetchError } = await supabase
      .from('enrichment_jobs')
      .select('id, person_id, project_id')
      .eq('external_job_id', enrichmentId);

    if (fetchError || !jobs || jobs.length === 0) {
      console.error('Enrichment jobs not found for external ID:', enrichmentId);
      return NextResponse.json({ error: 'Jobs not found' }, { status: 404 });
    }

    // Handle failed/canceled/insufficient credits statuses
    if (status === 'CANCELED' || status === 'CREDITS_INSUFFICIENT' || status === 'RATE_LIMIT') {
      const errorMessage = status === 'CREDITS_INSUFFICIENT'
        ? 'Insufficient credits'
        : status === 'RATE_LIMIT'
          ? 'Rate limit exceeded'
          : error ?? 'Enrichment canceled';

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
        // Individual result failed
        await supabase
          .from('enrichment_jobs')
          .update({
            status: 'failed',
            error: record.error,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        continue;
      }

      // Extract data from FullEnrich format
      const contactInfo = record.contact_info;
      const profile = record.profile;

      // Convert result to EnrichmentPerson format
      const enrichmentResult: EnrichmentPerson = {
        email: contactInfo?.email?.email ?? contactInfo?.emails?.[0]?.email ?? null,
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
        full_name: profile?.full_name ?? null,
        job_title: profile?.job_title ?? null,
        company_name: profile?.company ?? null,
        company_domain: null,
        linkedin_url: profile?.linkedin_url ?? null,
        phone: contactInfo?.phone?.phone ?? contactInfo?.phones?.[0]?.phone ?? null,
        location: profile?.location ? {
          city: profile.location.city ?? null,
          state: profile.location.state ?? null,
          country: profile.location.country ?? null,
        } : null,
        work_email: contactInfo?.emails?.find(e => e.type === 'work')?.email ?? null,
        personal_email: contactInfo?.emails?.find(e => e.type === 'personal')?.email ?? null,
        mobile_phone: contactInfo?.phones?.find(p => p.type === 'mobile')?.phone ?? null,
        work_phone: contactInfo?.phones?.find(p => p.type === 'work')?.phone ?? null,
        confidence_score: null,
      };

      // Update job with results
      await supabase
        .from('enrichment_jobs')
        .update({
          status: 'completed',
          result: enrichmentResult,
          credits_used: creditsPerJob,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      // Fetch current person data
      const { data: person } = await supabase
        .from('people')
        .select('*')
        .eq('id', job.person_id)
        .single();

      if (person) {
        // Apply enrichment updates to person
        const updates = mapEnrichmentToPerson(enrichmentResult, person);
        console.log('Applying enrichment updates to person:', { personId: job.person_id, updates });
        if (Object.keys(updates).length > 0) {
          await supabase
            .from('people')
            .update(updates)
            .eq('id', job.person_id);
        }
      }
    }

    return NextResponse.json({
      processed: jobs.length,
      status: 'completed',
      credits_used,
    });
  } catch (error) {
    console.error('Error in POST /api/webhooks/fullenrich:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
