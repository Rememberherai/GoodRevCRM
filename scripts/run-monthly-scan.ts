#!/usr/bin/env tsx
/**
 * Monthly Municipal Scanner Runner
 *
 * Orchestrates a full monthly scan:
 * 1. Re-scans all USA municipalities
 * 2. Re-scans all Canada municipalities
 * 3. Runs enrichment on new unenriched RFPs
 * 4. Prints summary
 *
 * Usage:
 *   npx tsx scripts/run-monthly-scan.ts                    # Full monthly scan (USA + Canada)
 *   npx tsx scripts/run-monthly-scan.ts --country USA      # USA only
 *   npx tsx scripts/run-monthly-scan.ts --country Canada   # Canada only
 *   npx tsx scripts/run-monthly-scan.ts --dry-run          # Preview without writing
 *   npx tsx scripts/run-monthly-scan.ts --limit 10         # Test with 10 municipalities
 */

import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SCAN_BATCH = new Date().toISOString().substring(0, 7);

function parseArgs() {
  const args = process.argv.slice(2);
  const options: { country?: string; dryRun?: boolean; limit?: number; skipEnrich?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--country' && args[i + 1]) {
      options.country = args[++i];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[++i], 10);
    } else if (arg === '--skip-enrich') {
      options.skipEnrich = true;
    }
  }

  return options;
}

function runScan(country: string, extraArgs: string = '') {
  const cmd = `npx tsx scripts/scan-municipal-minutes.ts --rescan --country ${country} ${extraArgs}`;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${cmd}`);
  console.log('='.repeat(60) + '\n');

  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
  } catch (error: any) {
    console.error(`\nScan for ${country} exited with error. Continuing...`);
  }
}

async function printSummary() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Monthly Scan Summary - ${SCAN_BATCH}`);
  console.log('='.repeat(60) + '\n');

  // Count RFPs for this scan batch
  const { data: batchRfps, error } = await supabase
    .from('rfps')
    .select('id, title, scan_batch, custom_fields, estimated_value, organization:organizations(name, address_state, address_country)')
    .eq('scan_batch', SCAN_BATCH);

  if (error) {
    console.error('Error fetching summary:', error.message);
    return;
  }

  const rfps = batchRfps || [];
  const newRfps = rfps.filter((r: any) => {
    const created = new Date(r.created_at || '').toISOString().substring(0, 7);
    return created === SCAN_BATCH;
  });

  const usaRfps = rfps.filter((r: any) => r.custom_fields?.country === 'USA');
  const canadaRfps = rfps.filter((r: any) => r.custom_fields?.country === 'Canada');

  console.log(`Scan Batch: ${SCAN_BATCH}`);
  console.log(`Total RFPs touched this batch: ${rfps.length}`);
  console.log(`  USA: ${usaRfps.length}`);
  console.log(`  Canada: ${canadaRfps.length}`);
  console.log('');

  // Value summary
  const withValues = rfps.filter((r: any) => r.estimated_value);
  if (withValues.length > 0) {
    const totalValue = withValues.reduce((sum: number, r: any) => sum + (r.estimated_value || 0), 0);
    console.log(`Total estimated value: $${totalValue.toLocaleString()}`);
    console.log(`RFPs with values: ${withValues.length} of ${rfps.length}`);
  }

  console.log('\nView in CRM: Filter RFPs by Scan Batch = "' + SCAN_BATCH + '"');
  console.log('');
}

async function main() {
  const options = parseArgs();

  console.log('='.repeat(60));
  console.log('Municipal Scanner - Monthly Run');
  console.log('='.repeat(60));
  console.log(`\nScan batch: ${SCAN_BATCH}`);
  console.log(`Date: ${new Date().toISOString()}`);

  if (options.dryRun) {
    console.log('\nDRY RUN MODE - No data will be written');
  }

  const extraArgs = [
    options.dryRun ? '--dry-run' : '',
    options.limit ? `--limit ${options.limit}` : '',
  ].filter(Boolean).join(' ');

  const countries = options.country
    ? [options.country]
    : ['USA', 'Canada'];

  // Run scans
  for (const country of countries) {
    runScan(country, extraArgs);
  }

  // Run enrichment (unless skipped or dry run)
  if (!options.skipEnrich && !options.dryRun) {
    console.log(`\n${'='.repeat(60)}`);
    console.log('Running enrichment on new RFPs...');
    console.log('='.repeat(60) + '\n');

    try {
      execSync('npx tsx scripts/municipal/enrichment/enrich-all-wwtp-rfps.ts --limit 50', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
    } catch (error: any) {
      console.error('Enrichment had errors. Continuing...');
    }
  }

  // Print summary
  if (!options.dryRun) {
    await printSummary();
  }

  console.log('Monthly scan complete!');
}

main().catch(console.error);
