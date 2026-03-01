import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRfpTitles() {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('rfps')
    .select('title, estimated_value, custom_fields')
    .eq('custom_fields->>source', 'municipal_minutes')
    .gte('created_at', thirtyMinAgo)
    .order('created_at', { ascending: false });

  if (!data || data.length === 0) {
    console.log('No RFPs found.');
    return;
  }

  console.log('\n=== Quality Check: Titles and Values ===\n');

  // Check for potential low-quality keywords
  const lowQualityKeywords = [
    'supply', 'hypochlorite', 'alum', 'sulfate', 'chemical',
    'maintenance contract', 'testing service'
  ];

  const suspicious = data.filter(r => {
    const title = r.title.toLowerCase();
    return lowQualityKeywords.some(kw => title.includes(kw));
  });

  console.log('Total RFPs: ' + data.length);
  console.log('Suspicious (may be low-value): ' + suspicious.length);
  console.log('');

  if (suspicious.length > 0) {
    console.log('Potentially Low-Quality RFPs:');
    suspicious.forEach((r, i) => {
      console.log(`${i+1}. ${r.title}`);
      console.log(`   Value: ${r.estimated_value ? '$' + r.estimated_value.toLocaleString() : 'Not specified'}`);
    });
  } else {
    console.log('✅ No obvious low-quality RFPs detected!');
    console.log('All titles appear to be capital projects.');
  }

  console.log('\n=== Sample Titles (all ' + data.length + ' RFPs) ===\n');
  data.forEach((r, i) => {
    console.log(`${i+1}. ${r.title}`);
    if (r.estimated_value) {
      console.log(`   💰 $${r.estimated_value.toLocaleString()} ${r.custom_fields?.currency || 'CAD'}`);
    }
  });
}

checkRfpTitles().catch(console.error);
