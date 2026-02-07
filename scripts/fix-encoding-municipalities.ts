#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const updates = [
  {
    id: "e6074adb-3698-406b-9370-45bbc3dbc768",
    name: "Burk's Falls, Village of",
    url: "https://www.burksfalls.net/townhall/council/agenda-minutes"
  },
  {
    id: "f04d29d8-a474-44bf-ba04-af66053c0a50",
    name: "Mattice-Val Côté, Township of",
    url: "https://www.matticevalcote.ca/en/conseil-municipal"
  },
  {
    id: "59740c09-0379-4d7e-94a1-60a95387dab5",
    name: "O'Connor, Township of",
    url: "https://www.oconnortownship.ca/municipal-office/council/"
  }
];

async function main() {
  console.log(`\n📥 Updating ${updates.length} municipalities by ID to fix encoding issues...\n`);

  let updated = 0;
  for (const item of updates) {
    const { error } = await supabase
      .from('municipalities')
      .update({
        minutes_url: item.url,
        scan_status: 'pending'
      })
      .eq('id', item.id);

    if (!error) {
      console.log(`   ✅ ${item.name}`);
      updated++;
    } else {
      console.error(`   ❌ ${item.name}: ${error.message}`);
    }
  }

  console.log(`\n📊 ✅ Updated: ${updated}/${updates.length}`);
  console.log(`\n🎉 All Ontario municipalities now have minutes URLs!`);
}

main().catch(console.error);
