#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { scanMunicipality } from '../lib/municipal-scanner/scanner';
import { ScanLogger } from '../lib/municipal-scanner/logger';
import { SCANNER_CONFIG } from '../lib/municipal-scanner/config';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function scanOntario() {
  const logger = new ScanLogger();

  logger.logHeader();
  console.log('🍁 Ontario Municipal RFP Scanner');
  console.log('====================================\n');

  // Fetch all Ontario municipalities
  const { data: municipalities, error } = await supabase
    .from('municipalities')
    .select('*')
    .eq('province', 'Ontario')
    .not('minutes_url', 'is', null)
    .order('population', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('❌ Error fetching municipalities:', error);
    return;
  }

  if (!municipalities || municipalities.length === 0) {
    console.log('⚠️  No Ontario municipalities found with minutes URLs');
    return;
  }

  console.log(`Found ${municipalities.length} Ontario municipalities with minutes URLs\n`);
  console.log('Top 20 by population:');
  municipalities.slice(0, 20).forEach((m, idx) => {
    console.log(`  ${idx + 1}. ${m.name} - ${m.population?.toLocaleString() || 'N/A'} people`);
  });
  console.log();

  logger.logConfig({
    projectId: SCANNER_CONFIG.projectId,
    totalMunicipalities: municipalities.length,
    dateRange: 12,
  });

  console.log('Starting scan...\n');

  const startTime = Date.now();
  let totalRfps = 0;
  let successCount = 0;
  let errorCount = 0;

  // Scan each municipality
  for (let i = 0; i < municipalities.length; i++) {
    const municipality = municipalities[i];

    console.log(`[${i + 1}/${municipalities.length}] ${municipality.name}, Ontario`);
    console.log(`  📄 Minutes URL: ${municipality.minutes_url}`);
    console.log(`  👥 Population: ${municipality.population?.toLocaleString() || 'Unknown'}`);

    try {
      const result = await scanMunicipality(municipality, supabase, SCANNER_CONFIG);

      if (result.rfpsCreated > 0) {
        totalRfps += result.rfpsCreated;
        successCount++;
        console.log(`  ✅ Success - ${result.rfpsCreated} RFPs found\n`);
      } else {
        console.log(`  ⚪ No RFPs found\n`);
      }

      // Update municipality status
      await supabase
        .from('municipalities')
        .update({
          last_scanned_at: new Date().toISOString(),
          scan_status: 'success',
          rfps_found_count: result.rfpsCreated,
        })
        .eq('id', municipality.id);

    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}\n`);
      errorCount++;

      // Update municipality with error
      await supabase
        .from('municipalities')
        .update({
          last_scanned_at: new Date().toISOString(),
          scan_status: 'failed',
          scan_error: error.message,
        })
        .eq('id', municipality.id);
    }

    // Progress update every 10 municipalities
    if ((i + 1) % 10 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
      const avgPerMuni = elapsed / (i + 1);
      const remaining = Math.round(avgPerMuni * (municipalities.length - i - 1));

      console.log(`\n📊 Progress: ${i + 1}/${municipalities.length} (${Math.round((i + 1) / municipalities.length * 100)}%)`);
      console.log(`   RFPs found so far: ${totalRfps}`);
      console.log(`   Success rate: ${Math.round(successCount / (i + 1) * 100)}%`);
      console.log(`   Time elapsed: ${elapsed} minutes`);
      console.log(`   Estimated time remaining: ${remaining} minutes\n`);
    }
  }

  // Final summary
  const duration = Math.round((Date.now() - startTime) / 1000 / 60);

  console.log('\n====================================');
  console.log('Scan Complete!');
  console.log('====================================\n');

  logger.logSummary({
    totalMunicipalities: municipalities.length,
    rfpsDetected: totalRfps,
    rfpsCreated: totalRfps,
    organizationsCreated: 0,
    errors: errorCount,
    duration: `${duration} minutes`,
    provinceBreakdown: { Ontario: totalRfps },
  });

  console.log(`\n✅ Successfully scanned: ${successCount}/${municipalities.length} municipalities`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📊 Total RFPs found: ${totalRfps}`);
  console.log(`⏱️  Total time: ${duration} minutes (${(duration / municipalities.length).toFixed(1)} min/municipality)\n`);
}

scanOntario().catch(console.error);
