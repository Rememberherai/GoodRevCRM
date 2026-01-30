import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { enrichmentWebhookSchema } from '@/lib/validators/enrichment';
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

    const { job_id, status, results, error, credits_used } = validationResult.data;

    // Create admin client (bypasses RLS for webhook processing)
    const supabase = createAdminClient();

    // Find all enrichment jobs with this external job ID
    const { data: jobs, error: fetchError } = await supabase
      .from('enrichment_jobs')
      .select('id, person_id, project_id')
      .eq('external_job_id', job_id);

    if (fetchError || !jobs || jobs.length === 0) {
      console.error('Enrichment jobs not found for external ID:', job_id);
      return NextResponse.json({ error: 'Jobs not found' }, { status: 404 });
    }

    if (status === 'failed') {
      // Mark all jobs as failed
      await supabase
        .from('enrichment_jobs')
        .update({
          status: 'failed',
          error: error ?? 'Enrichment failed',
          completed_at: new Date().toISOString(),
        })
        .eq('external_job_id', job_id);

      return NextResponse.json({ processed: jobs.length, status: 'failed' });
    }

    // Process completed results
    if (!results || results.length === 0) {
      await supabase
        .from('enrichment_jobs')
        .update({
          status: 'completed',
          credits_used: credits_used ?? 0,
          completed_at: new Date().toISOString(),
        })
        .eq('external_job_id', job_id);

      return NextResponse.json({ processed: jobs.length, status: 'completed' });
    }

    // Map results to jobs and update
    const creditsPerJob = credits_used ? Math.ceil(credits_used / jobs.length) : 1;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]!;
      const result = results[i];

      if (!result) {
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

      if (result.error) {
        // Individual result failed
        await supabase
          .from('enrichment_jobs')
          .update({
            status: 'failed',
            error: result.error,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        continue;
      }

      // Convert result to EnrichmentPerson format
      const enrichmentResult: EnrichmentPerson = {
        email: result.email ?? null,
        first_name: result.first_name ?? null,
        last_name: result.last_name ?? null,
        full_name: null,
        job_title: result.job_title ?? null,
        company_name: null,
        company_domain: null,
        linkedin_url: result.linkedin_url ?? null,
        phone: result.phone ?? null,
        location: result.location ?? null,
        work_email: null,
        personal_email: null,
        mobile_phone: null,
        work_phone: null,
        confidence_score: result.confidence_score ?? null,
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
