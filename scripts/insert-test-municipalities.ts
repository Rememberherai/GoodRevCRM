import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Use service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const testMunicipalities = [
  {
    name: 'Halifax',
    province: 'Nova Scotia',
    country: 'Canada',
    official_website: 'https://www.halifax.ca',
    municipality_type: 'city',
    population: 450000,
    scan_status: 'pending'
  },
  {
    name: 'Guelph',
    province: 'Ontario',
    country: 'Canada',
    official_website: 'https://guelph.ca',
    municipality_type: 'city',
    population: 120000,
    scan_status: 'pending'
  },
  {
    name: 'Kelowna',
    province: 'British Columbia',
    country: 'Canada',
    official_website: 'https://www.kelowna.ca',
    municipality_type: 'city',
    population: 140000,
    scan_status: 'pending'
  },
  {
    name: 'Red Deer',
    province: 'Alberta',
    country: 'Canada',
    official_website: 'https://www.reddeer.ca',
    municipality_type: 'city',
    population: 100000,
    scan_status: 'pending'
  },
  {
    name: 'Charlottetown',
    province: 'Prince Edward Island',
    country: 'Canada',
    official_website: 'https://www.charlottetown.ca',
    municipality_type: 'city',
    population: 40000,
    scan_status: 'pending'
  }
];

async function insertTestMunicipalities() {
  console.log('🇨🇦 Inserting test municipalities into database...\n');

  for (const municipality of testMunicipalities) {
    const { data, error } = await supabase
      .from('municipalities')
      .insert(municipality)
      .select()
      .single();

    if (error) {
      console.error(`❌ Error inserting ${municipality.name}:`, error.message);
    } else {
      console.log(`✓ Inserted: ${municipality.name}, ${municipality.province}`);
    }
  }

  console.log('\n✅ Test municipalities inserted successfully!');
}

insertTestMunicipalities();
