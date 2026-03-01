import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRecentRFPs() {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('rfps')
    .select('title, description, estimated_value, currency, custom_fields, created_at')
    .eq('custom_fields->>source', 'municipal_minutes')
    .gte('created_at', thirtyMinAgo)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== RFPs Created in Last 30 Minutes ===\n');
  console.log(`Total Found: ${data?.length || 0}\n`);

  if (!data || data.length === 0) {
    console.log('No RFPs found in the last 30 minutes.');
    console.log('The scanner may still be running or no new RFPs were extracted.\n');
    return;
  }

  // Summary stats
  const withValue = data.filter(r => r.estimated_value).length;
  const avgConfidence = data.reduce((sum, r) => sum + (r.custom_fields?.ai_confidence || 0), 0) / data.length;
  const byType = data.reduce((acc: Record<string, number>, r) => {
    const type = r.custom_fields?.opportunity_type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  console.log('Summary Statistics:');
  console.log(`  RFPs with estimated value: ${withValue}/${data.length} (${((withValue/data.length)*100).toFixed(1)}%)`);
  console.log(`  Average AI confidence: ${avgConfidence.toFixed(1)}%`);
  console.log(`  By type:`);
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`    - ${type}: ${count}`);
  });
  console.log('');

  // Show first 5 in detail
  const toShow = data.slice(0, 5);
  toShow.forEach((rfp, idx) => {
    console.log(`[${idx + 1}] ${rfp.title}`);
    console.log(`Created: ${new Date(rfp.created_at).toLocaleString()}`);
    console.log(`Value: ${rfp.estimated_value ? '$' + rfp.estimated_value.toLocaleString() + ' ' + rfp.currency : 'Not specified'}`);
    console.log(`Confidence: ${rfp.custom_fields?.ai_confidence || 'N/A'}%`);
    console.log(`Type: ${rfp.custom_fields?.opportunity_type || 'N/A'}`);
    console.log(`Region: ${rfp.custom_fields?.region || 'N/A'}`);

    console.log(`\nDescription (${rfp.description.length} chars):`);
    console.log(rfp.description.substring(0, 300) + (rfp.description.length > 300 ? '...' : ''));
    console.log(`\n${'='.repeat(100)}\n`);
  });

  if (data.length > 5) {
    console.log(`... and ${data.length - 5} more RFPs\n`);
  }
}

checkRecentRFPs().catch(console.error);
