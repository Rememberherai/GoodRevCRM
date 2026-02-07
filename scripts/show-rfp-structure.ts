import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function showStructure() {
  const { data } = await supabase
    .from('rfps')
    .select('*')
    .eq('project_id', '92352069-9031-4f9c-a89b-e09dc51d2d16')
    .order('created_at', { ascending: false })
    .limit(2);

  console.log(JSON.stringify(data, null, 2));
}

showStructure();
