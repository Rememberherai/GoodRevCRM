import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const minutesUrls = [
  { name: 'Halifax', url: 'https://pub-halifax.escribemeetings.com' },
  { name: 'Guelph', url: 'https://pub-guelph.escribemeetings.com' },
  { name: 'Kelowna', url: 'https://kelownapublishing.escribemeetings.com' },
  { name: 'Red Deer', url: 'https://www.reddeer.ca/city-government/city-council' },
  { name: 'Charlottetown', url: 'https://www.charlottetown.ca/government/council-minutes' }
];

async function updateMinutesUrls() {
  console.log('📄 Updating minutes URLs for test municipalities...\n');

  for (const { name, url } of minutesUrls) {
    const { error } = await supabase
      .from('municipalities')
      .update({ minutes_url: url })
      .eq('name', name);

    if (error) {
      console.error(`❌ Error updating ${name}:`, error.message);
    } else {
      console.log(`✓ Updated ${name}: ${url}`);
    }
  }

  console.log('\n✅ Minutes URLs updated successfully!');
}

updateMinutesUrls();
