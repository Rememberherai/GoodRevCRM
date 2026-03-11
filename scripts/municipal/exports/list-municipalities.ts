import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function listMunicipalities() {
  const { data, error } = await supabase
    .from('municipalities')
    .select('*')
    .order('province', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('🇨🇦 Municipalities in Database\n');
  console.log(`Total: ${data.length}\n`);

  let currentProvince = '';
  for (const m of data) {
    if (m.province !== currentProvince) {
      currentProvince = m.province;
      console.log(`\n${currentProvince}:`);
    }

    const status = m.scan_status === 'pending' ? '⏳' :
                   m.scan_status === 'success' ? '✅' :
                   m.scan_status === 'failed' ? '❌' : '⚪';

    console.log(`  ${status} ${m.name}`);
    if (m.minutes_url) {
      console.log(`     Minutes: ${m.minutes_url}`);
    }
    if (m.rfps_found_count > 0) {
      console.log(`     RFPs found: ${m.rfps_found_count}`);
    }
  }
}

listMunicipalities();
