import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getProjectId() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .limit(1)
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Project ID:', data.id);
    console.log('Project Name:', data.name);
  }
}

getProjectId();
