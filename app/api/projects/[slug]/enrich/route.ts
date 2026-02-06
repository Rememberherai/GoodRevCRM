import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  enrichPersonSchema,
  bulkEnrichSchema,
  enrichmentHistoryQuerySchema,
} from '@/lib/validators/enrichment';
import { getFullEnrichClient, type EnrichmentPerson } from '@/lib/fullenrich/client';
import type { EnrichmentJob, EnrichmentInput } from '@/types/enrichment';
import type { EnrichmentStatus } from '@/lib/fullenrich/client';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// Database row type for enrichment_jobs (until types are regenerated)
interface EnrichmentJobRow {
  id: string;
  project_id: string;
  person_id: string;
  external_job_id: string | null;
  status: EnrichmentStatus;
  input_data: EnrichmentInput;
  result: EnrichmentPerson | null;
  error: string | null;
  credits_used: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
}

// GET /api/projects/[slug]/enrich - Get enrichment history (also polls FullEnrich for processing jobs)
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project ID from slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const poll = searchParams.get('poll') === 'true';
    const queryResult = enrichmentHistoryQuerySchema.safeParse({
      person_id: searchParams.get('person_id') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { person_id, status, limit = 50, offset = 0 } = queryResult.data;

    // Use type assertion since table isn't in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseQuery = supabase as any;

    let queryBuilder = supabaseQuery
      .from('enrichment_jobs')
      .select('*')
      .eq('project_id', project.id);

    if (person_id) {
      queryBuilder = queryBuilder.eq('person_id', person_id);
    }
    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    let { data: jobs, error } = await queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching enrichment jobs:', error);
      return NextResponse.json({ error: 'Failed to fetch enrichment history' }, { status: 500 });
    }

    // If poll=true, check FullEnrich for updates on processing jobs
    // Note: We only update the enrichment_jobs table, NOT the people table
    // User must review and select which fields to apply via the review modal
    console.log('Poll check:', { poll, jobsLength: jobs?.length });
    if (poll && jobs && jobs.length > 0) {
      const processingJobs = (jobs as EnrichmentJobRow[]).filter(
        (j) => j.status === 'processing' && j.external_job_id
      );
      console.log('Processing jobs found:', processingJobs.length);

      if (processingJobs.length > 0) {
        try {
          const client = getFullEnrichClient();
          console.log('FullEnrich client created, polling jobs...');

          // Group jobs by external_job_id to avoid duplicate API calls for bulk enrichments
          const jobsByExternalId = new Map<string, EnrichmentJobRow[]>();
          for (const job of processingJobs) {
            const externalId = job.external_job_id!;
            if (!jobsByExternalId.has(externalId)) {
              jobsByExternalId.set(externalId, []);
            }
            jobsByExternalId.get(externalId)!.push(job);
          }

          for (const [externalJobId, jobGroup] of jobsByExternalId) {
            console.log('Polling external job:', externalJobId, 'for', jobGroup.length, 'internal jobs');
            try {
              const result = await client.getJobStatus(externalJobId);
              console.log('FullEnrich poll result:', JSON.stringify(result, null, 2));

              // Check if job is finished
              if (result.status === 'completed' && result.results && result.results.length > 0) {
                // For bulk enrichment, match results to jobs using input data (linkedin_url or email)
                for (const job of jobGroup) {
                  const inputData = job.input_data as EnrichmentInput;

                  // Find matching result by linkedin_url first, then email, then name
                  let enrichmentResult = result.results.find((r: EnrichmentPerson) => {
                    if (inputData.linkedin_url && r.linkedin_url) {
                      return r.linkedin_url.toLowerCase().includes(inputData.linkedin_url.toLowerCase()) ||
                             inputData.linkedin_url.toLowerCase().includes(r.linkedin_url.toLowerCase());
                    }
                    return false;
                  });

                  if (!enrichmentResult) {
                    enrichmentResult = result.results.find((r: EnrichmentPerson) => {
                      if (inputData.email && r.email) {
                        return r.email.toLowerCase() === inputData.email.toLowerCase();
                      }
                      return false;
                    });
                  }

                  if (!enrichmentResult) {
                    enrichmentResult = result.results.find((r: EnrichmentPerson) => {
                      if (inputData.first_name && inputData.last_name && r.first_name && r.last_name) {
                        return r.first_name.toLowerCase() === inputData.first_name.toLowerCase() &&
                               r.last_name.toLowerCase() === inputData.last_name.toLowerCase();
                      }
                      return false;
                    });
                  }

                  // Fallback: if only one result and one job, use it
                  if (!enrichmentResult && result.results.length === 1 && jobGroup.length === 1) {
                    enrichmentResult = result.results[0];
                  }

                  if (enrichmentResult) {
                    // Update job in database with enrichment results (but NOT the person record)
                    await supabaseQuery
                      .from('enrichment_jobs')
                      .update({
                        status: 'completed',
                        result: enrichmentResult,
                        credits_used: Math.ceil((result.credits_used ?? jobGroup.length) / jobGroup.length),
                        completed_at: new Date().toISOString(),
                      })
                      .eq('id', job.id);

                    // Update job in response
                    const jobIndex = jobs.findIndex((j: EnrichmentJobRow) => j.id === job.id);
                    if (jobIndex !== -1) {
                      jobs[jobIndex] = {
                        ...jobs[jobIndex],
                        status: 'completed',
                        result: enrichmentResult,
                        completed_at: new Date().toISOString(),
                      };
                    }
                  } else {
                    console.log('No matching result found for job:', job.id, 'input:', inputData);
                  }
                }
              } else if (result.status === 'failed') {
                // Mark all jobs in this group as failed
                for (const job of jobGroup) {
                  await supabaseQuery
                    .from('enrichment_jobs')
                    .update({
                      status: 'failed',
                      error: result.error ?? 'Enrichment failed',
                      completed_at: new Date().toISOString(),
                    })
                    .eq('id', job.id);

                  const jobIndex = jobs.findIndex((j: EnrichmentJobRow) => j.id === job.id);
                  if (jobIndex !== -1) {
                    jobs[jobIndex] = {
                      ...jobs[jobIndex],
                      status: 'failed',
                      error: result.error ?? 'Enrichment failed',
                      completed_at: new Date().toISOString(),
                    };
                  }
                }
              }
            } catch (pollError) {
              console.error('Error polling FullEnrich for external job:', externalJobId, 'Error:', pollError instanceof Error ? pollError.message : pollError);
              // Continue with other job groups
            }
          }
        } catch (clientError) {
          console.error('Error creating FullEnrich client for polling:', clientError instanceof Error ? clientError.message : clientError);
          // Continue without polling
        }
      }
    }

    return NextResponse.json({
      jobs: (jobs ?? []) as EnrichmentJob[],
      pagination: {
        total: 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/enrich:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/enrich - Mark enrichment job as reviewed
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const jobId = body.job_id;

    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ error: 'job_id is required' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { error } = await supabaseAny
      .from('enrichment_jobs')
      .update({ reviewed_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('project_id', project.id);

    if (error) {
      console.error('Error marking enrichment as reviewed:', error);
      return NextResponse.json({ error: 'Failed to update enrichment job' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/enrich:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/enrich - Start enrichment job(s)
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project ID from slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();

    // Check if it's a single person or bulk request
    const singleResult = enrichPersonSchema.safeParse(body);
    const bulkResult = bulkEnrichSchema.safeParse(body);

    if (!singleResult.success && !bulkResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: singleResult.error.flatten() },
        { status: 400 }
      );
    }

    const isBulk = bulkResult.success;
    const personIds = isBulk ? bulkResult.data.person_ids : [singleResult.data!.person_id];

    // Fetch people to enrich
    const { data: people, error: peopleError } = await supabase
      .from('people')
      .select('id, first_name, last_name, email, linkedin_url, job_title')
      .eq('project_id', project.id)
      .in('id', personIds)
      .is('deleted_at', null);

    if (peopleError || !people || people.length === 0) {
      return NextResponse.json({ error: 'People not found' }, { status: 404 });
    }

    // Get primary organizations for people through junction table
    const { data: personOrgs } = await supabase
      .from('person_organizations')
      .select('person_id, organization_id')
      .in('person_id', personIds)
      .eq('is_primary', true);

    type PersonOrgRow = { person_id: string; organization_id: string };
    const personOrgsList = (personOrgs ?? []) as PersonOrgRow[];
    const personToOrgId = new Map(personOrgsList.map((po) => [po.person_id, po.organization_id]));
    const orgIds = [...new Set(personOrgsList.map((po) => po.organization_id))];

    let organizations: { id: string; name: string; domain: string | null }[] = [];
    if (orgIds.length > 0) {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, domain')
        .in('id', orgIds);
      organizations = orgs ?? [];
    }

    const orgMap = new Map(organizations.map((o) => [o.id, o]));

    // Use type assertion for enrichment_jobs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Process single person enrichment (uses same bulk flow since FullEnrich is async)
    if (!isBulk) {
      const person = people[0]!;
      const primaryOrgId = personToOrgId.get(person.id);
      const org = primaryOrgId ? orgMap.get(primaryOrgId) : null;

      // Build input data
      const inputData: EnrichmentInput = {
        email: person.email ?? undefined,
        linkedin_url: person.linkedin_url ?? undefined,
        first_name: person.first_name ?? undefined,
        last_name: person.last_name ?? undefined,
        company_name: org?.name,
        company_domain: org?.domain ?? undefined,
      };

      // Create job record
      const { data: job, error: insertError } = await supabaseAny
        .from('enrichment_jobs')
        .insert({
          project_id: project.id,
          person_id: person.id,
          status: 'pending',
          input_data: inputData,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError || !job) {
        console.error('Error creating enrichment job:', insertError);
        return NextResponse.json({ error: 'Failed to create enrichment job' }, { status: 500 });
      }

      // Start enrichment with FullEnrich (async - results come via webhook)
      try {
        const client = getFullEnrichClient();
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/fullenrich`;

        const enrichRequest = await client.enrichPerson(inputData, webhookUrl);

        // Update job with external job ID
        const { data: updatedJob } = await supabaseAny
          .from('enrichment_jobs')
          .update({
            external_job_id: enrichRequest.id,
            status: 'processing',
            started_at: new Date().toISOString(),
          })
          .eq('id', job.id)
          .select()
          .single();

        return NextResponse.json({
          job: updatedJob ?? { ...job, status: 'processing', external_job_id: enrichRequest.id },
          message: 'Enrichment started. Results will be available shortly.',
        });
      } catch (enrichError) {
        console.error('Enrichment error:', enrichError);

        let errorMessage = 'Enrichment failed';
        if (enrichError instanceof Error) {
          errorMessage = enrichError.message;
          // Include response body if it's a FullEnrichError
          if ('responseBody' in enrichError && enrichError.responseBody) {
            console.error('FullEnrich response body:', enrichError.responseBody);
            const body = enrichError.responseBody as Record<string, unknown>;
            if (body.error) {
              errorMessage = String(body.error);
            } else if (body.message) {
              errorMessage = String(body.message);
            }
          }
        }

        await supabaseAny
          .from('enrichment_jobs')
          .update({
            status: 'failed',
            error: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        return NextResponse.json({ job: { ...job, status: 'failed', error: errorMessage } });
      }
    }

    // Process bulk enrichment
    const jobInserts = people.map((person) => {
      const primaryOrgId = personToOrgId.get(person.id);
      const org = primaryOrgId ? orgMap.get(primaryOrgId) : null;
      return {
        project_id: project.id,
        person_id: person.id,
        status: 'pending',
        input_data: {
          email: person.email ?? undefined,
          linkedin_url: person.linkedin_url ?? undefined,
          first_name: person.first_name ?? undefined,
          last_name: person.last_name ?? undefined,
          company_name: org?.name,
          company_domain: org?.domain ?? undefined,
        },
        created_by: user.id,
      };
    });

    const { data: insertedJobs, error: insertError } = await supabaseAny
      .from('enrichment_jobs')
      .insert(jobInserts)
      .select();

    if (insertError) {
      console.error('Error creating enrichment jobs:', insertError);
      return NextResponse.json({ error: 'Failed to create enrichment jobs' }, { status: 500 });
    }

    // Start bulk enrichment with FullEnrich
    try {
      const client = getFullEnrichClient();
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/fullenrich`;

      const bulkRequest = await client.startBulkEnrich({
        people: jobInserts.map((j) => j.input_data),
        webhook_url: webhookUrl,
      });

      // Update all jobs with external job ID
      await supabaseAny
        .from('enrichment_jobs')
        .update({
          external_job_id: bulkRequest.id,
          status: 'processing',
          started_at: new Date().toISOString(),
        })
        .in('id', (insertedJobs as EnrichmentJobRow[]).map((j) => j.id));

      return NextResponse.json({
        jobs: insertedJobs,
        bulk_job_id: bulkRequest.id,
        status: 'processing',
        estimated_completion: bulkRequest.estimated_completion,
      });
    } catch (enrichError) {
      const errorMessage = enrichError instanceof Error ? enrichError.message : 'Bulk enrichment failed';

      // Mark all jobs as failed
      await supabaseAny
        .from('enrichment_jobs')
        .update({
          status: 'failed',
          error: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .in('id', (insertedJobs as EnrichmentJobRow[]).map((j) => j.id));

      return NextResponse.json(
        { error: errorMessage, jobs: insertedJobs?.map((j: EnrichmentJobRow) => ({ ...j, status: 'failed', error: errorMessage })) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/enrich:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
