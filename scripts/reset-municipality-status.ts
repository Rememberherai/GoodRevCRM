import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resetStatus() {
  const { error } = await supabase
    .from('municipalities')
    .update({ scan_status: 'pending', rfps_found_count: 0 })
    .eq('name', 'Halifax');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Reset Halifax to pending status');
  }
}

resetStatus();
