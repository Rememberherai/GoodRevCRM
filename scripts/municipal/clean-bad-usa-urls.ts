#!/usr/bin/env tsx
/**
 * Clean Bad USA Municipality URLs
 *
 * Removes minutes_url from USA municipalities so they can be re-scanned
 * with the improved AI prompt
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanBadUrls() {
  console.log('\n🧹 Cleaning Bad USA Municipality URLs');
  console.log('====================================\n');

  // Get all USA municipalities with minutes URLs
  const { data: municipalities } = await supabase
    .from('municipalities')
    .select('id, name, province, minutes_url')
    .eq('country', 'USA')
    .not('minutes_url', 'is', null);

  if (!municipalities || municipalities.length === 0) {
    console.log('No USA municipalities with URLs found.');
    return;
  }

  console.log(`Found ${municipalities.length} USA municipalities with URLs\n`);
  console.log('Clearing all URLs so they can be re-scanned with improved prompt...\n');

  // Clear all minutes URLs for USA municipalities
  const { error } = await supabase
    .from('municipalities')
    .update({
      minutes_url: null,
      scan_status: null,
    })
    .eq('country', 'USA')
    .not('minutes_url', 'is', null);

  if (error) {
    console.error('❌ Failed to clear URLs:', error);
  } else {
    console.log(`✅ Cleared ${municipalities.length} URLs\n`);
    console.log('Next step: Re-run URL finder with improved prompt:');
    console.log('  npm run find-usa-minutes-urls -- --min-population 10000 --limit 100\n');
  }
}

cleanBadUrls().catch(console.error);
