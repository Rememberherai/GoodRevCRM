#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log(`\n📥 Downloading Quebec municipalities CSV...\n`);

  // Fetch the CSV
  const response = await fetch('https://donneesouvertes.affmunqc.net/repertoire/MUN.csv');
  const csvText = await response.text();

  // Parse CSV (simple line-by-line parsing)
  const lines = csvText.split('\n');

  // Parse header row (handles quoted fields)
  const headers = lines[0]?.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(h => h.replace(/"/g, '').trim()) || [];

  // Find column indices
  const nameIdx = headers.indexOf('munnom');
  const websiteIdx = headers.indexOf('mweb');
  const populationIdx = headers.indexOf('mpopul');
  const typeIdx = headers.indexOf('mdes');
  const emailIdx = headers.indexOf('mcourriel');

  console.log(`Found ${lines.length - 1} municipalities in CSV`);
  console.log(`Columns: name=${nameIdx}, website=${websiteIdx}, population=${populationIdx}, type=${typeIdx}\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  // Process each line (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parsing (handles quoted fields)
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim());

    const name = fields[nameIdx]?.replace(/"/g, '').trim();
    const website = fields[websiteIdx]?.replace(/"/g, '').trim();
    const populationStr = fields[populationIdx]?.replace(/"/g, '').trim();
    const type = fields[typeIdx]?.replace(/"/g, '').trim();
    const email = fields[emailIdx]?.replace(/"/g, '').trim();

    if (!name) continue;

    const population = populationStr ? parseInt(populationStr, 10) : null;

    // Check if already exists
    const { data: existing } = await supabase
      .from('municipalities')
      .select('id')
      .eq('name', name)
      .eq('province', 'Quebec')
      .single();

    if (existing) {
      console.log(`   ⏭️  Skipped (exists): ${name}`);
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('municipalities')
      .insert({
        name: name,
        province: 'Quebec',
        country: 'Canada',
        municipality_type: type || 'Municipality',
        population: population,
        official_website: website || null,
        scan_status: 'no_minutes'
      });

    if (!error) {
      console.log(`   ✅ Inserted: ${name} (${type || 'N/A'})`);
      inserted++;
    } else {
      console.error(`   ❌ Error: ${name} - ${error.message}`);
      errors++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📋 Total processed: ${inserted + skipped + errors}`);
}

main().catch(console.error);
