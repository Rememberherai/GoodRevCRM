#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Fixing Halifax duplicate...\n');

  // Delete the newer duplicate
  const { error: deleteError } = await supabase
    .from('municipalities')
    .delete()
    .eq('id', '4e2402f5-32f9-4a5d-bfd2-8bd386c55d3e');

  if (deleteError) {
    console.error('Error deleting duplicate:', deleteError);
    return;
  }

  console.log('✅ Deleted duplicate "Halifax Regional Municipality"');

  // Update the existing Halifax entry with better name and municipality_type
  const { error: updateError } = await supabase
    .from('municipalities')
    .update({
      name: 'Halifax Regional Municipality',
      municipality_type: 'regional',
      minutes_url: 'https://www.halifax.ca/city-hall/agendas-meetings-reports'
    })
    .eq('id', '9319ff0a-51d5-4edc-8130-1c2ad5b97076');

  if (updateError) {
    console.error('Error updating Halifax:', updateError);
    return;
  }

  console.log('✅ Updated existing Halifax entry to "Halifax Regional Municipality" with correct type and URL');
  console.log('\n✨ Done!');
}

main();
