#!/usr/bin/env node

/**
 * Debug script for RFP research jobs
 *
 * Usage:
 *   node scripts/debug-rfp-research.js list        - List all research jobs
 *   node scripts/debug-rfp-research.js stuck       - List stuck jobs (running > 5 min)
 *   node scripts/debug-rfp-research.js cancel <id> - Cancel a specific job
 *   node scripts/debug-rfp-research.js cleanup     - Mark all stuck jobs as failed
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listJobs() {
  const { data, error } = await supabase
    .from('rfp_research_results')
    .select('id, rfp_id, status, created_at, started_at, completed_at, error')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching jobs:', error);
    process.exit(1);
  }

  console.log('\nRecent RFP Research Jobs:');
  console.log('='.repeat(80));

  if (!data || data.length === 0) {
    console.log('No research jobs found.');
    return;
  }

  data.forEach(job => {
    console.log(`ID: ${job.id}`);
    console.log(`Status: ${job.status}`);
    console.log(`Created: ${new Date(job.created_at).toLocaleString()}`);
    if (job.started_at) {
      console.log(`Started: ${new Date(job.started_at).toLocaleString()}`);
    }
    if (job.completed_at) {
      console.log(`Completed: ${new Date(job.completed_at).toLocaleString()}`);
    }
    if (job.error) {
      console.log(`Error: ${job.error}`);
    }
    console.log('-'.repeat(80));
  });
}

async function listStuckJobs() {
  // Find jobs that have been running for more than 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('rfp_research_results')
    .select('id, rfp_id, status, created_at, started_at')
    .eq('status', 'running')
    .lt('started_at', fiveMinutesAgo);

  if (error) {
    console.error('Error fetching stuck jobs:', error);
    process.exit(1);
  }

  console.log('\nStuck RFP Research Jobs (running > 5 minutes):');
  console.log('='.repeat(80));

  if (!data || data.length === 0) {
    console.log('No stuck jobs found.');
    return;
  }

  data.forEach(job => {
    const startedAt = new Date(job.started_at);
    const runningFor = Math.floor((Date.now() - startedAt.getTime()) / 1000 / 60);

    console.log(`ID: ${job.id}`);
    console.log(`RFP ID: ${job.rfp_id}`);
    console.log(`Started: ${startedAt.toLocaleString()}`);
    console.log(`Running for: ${runningFor} minutes`);
    console.log('-'.repeat(80));
  });

  console.log(`\nTotal stuck jobs: ${data.length}`);
  console.log('\nTo cancel these jobs, run:');
  console.log('  node scripts/debug-rfp-research.js cleanup');
}

async function cancelJob(jobId) {
  console.log(`Cancelling job ${jobId}...`);

  const { error } = await supabase
    .from('rfp_research_results')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error: 'Cancelled by admin',
    })
    .eq('id', jobId);

  if (error) {
    console.error('Error cancelling job:', error);
    process.exit(1);
  }

  console.log('Job cancelled successfully.');
}

async function cleanupStuckJobs() {
  // Find jobs that have been running for more than 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: stuckJobs, error: fetchError } = await supabase
    .from('rfp_research_results')
    .select('id')
    .eq('status', 'running')
    .lt('started_at', fiveMinutesAgo);

  if (fetchError) {
    console.error('Error fetching stuck jobs:', fetchError);
    process.exit(1);
  }

  if (!stuckJobs || stuckJobs.length === 0) {
    console.log('No stuck jobs found to clean up.');
    return;
  }

  console.log(`Found ${stuckJobs.length} stuck jobs. Marking as failed...`);

  const { error: updateError } = await supabase
    .from('rfp_research_results')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error: 'Job timed out (cleanup script)',
    })
    .eq('status', 'running')
    .lt('started_at', fiveMinutesAgo);

  if (updateError) {
    console.error('Error cleaning up stuck jobs:', updateError);
    process.exit(1);
  }

  console.log(`Successfully marked ${stuckJobs.length} jobs as failed.`);
}

// Main
const command = process.argv[2];
const arg = process.argv[3];

(async () => {
  try {
    switch (command) {
      case 'list':
        await listJobs();
        break;
      case 'stuck':
        await listStuckJobs();
        break;
      case 'cancel':
        if (!arg) {
          console.error('Usage: node scripts/debug-rfp-research.js cancel <job-id>');
          process.exit(1);
        }
        await cancelJob(arg);
        break;
      case 'cleanup':
        await cleanupStuckJobs();
        break;
      default:
        console.log('Usage:');
        console.log('  node scripts/debug-rfp-research.js list        - List all research jobs');
        console.log('  node scripts/debug-rfp-research.js stuck       - List stuck jobs');
        console.log('  node scripts/debug-rfp-research.js cancel <id> - Cancel a specific job');
        console.log('  node scripts/debug-rfp-research.js cleanup     - Mark all stuck jobs as failed');
        process.exit(1);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
})();
