#!/usr/bin/env tsx
/**
 * Import USA Municipalities from CSV
 *
 * Imports USA municipalities from a CSV file into the database
 *
 * Supports two CSV formats:
 * 1. Simple: name,state,population,municipality_type
 * 2. uscities.csv: "name","state_name","population","type"
 *
 * Usage: npm run import-usa-municipalities -- path/to/municipalities.csv [--min-population 10000]
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MunicipalityRow {
  name: string;
  state: string;
  population?: number;
  municipality_type?: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCSV(content: string, minPopulation: number = 0): MunicipalityRow[] {
  const lines = content.trim().split('\n');
  const headerLine = parseCSVLine(lines[0]);
  const headers = headerLine.map(h => h.replace(/"/g, '').trim());

  const municipalities: MunicipalityRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(v => v.replace(/"/g, '').trim());
    const row: any = {};

    headers.forEach((header, index) => {
      row[header] = values[index];
    });

    // Support both formats
    const name = row.name || row.name_ascii;
    const state = row.state || row.state_name;
    const population = row.population ? parseInt(row.population, 10) : undefined;
    const municipalityType = row.municipality_type || row.type || 'City';

    // Filter by minimum population if specified
    if (minPopulation > 0 && (!population || population < minPopulation)) {
      continue;
    }

    municipalities.push({
      name,
      state,
      population,
      municipality_type: municipalityType,
    });
  }

  return municipalities;
}

async function importMunicipalities(csvPath: string, minPopulation: number = 0) {
  console.log('\n🇺🇸 Importing USA Municipalities from CSV');
  console.log('==========================================\n');
  console.log(`Reading file: ${csvPath}`);
  if (minPopulation > 0) {
    console.log(`Minimum population filter: ${minPopulation.toLocaleString()}`);
  }
  console.log('');

  // Check if file exists
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }

  // Read and parse CSV
  const content = fs.readFileSync(csvPath, 'utf-8');
  const municipalities = parseCSV(content, minPopulation);

  console.log(`Found ${municipalities.length} municipalities in CSV\n`);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  // Group by state for better logging
  const byState: Record<string, number> = {};

  for (const muni of municipalities) {
    // Track state counts
    byState[muni.state] = (byState[muni.state] || 0) + 1;

    // Check if already exists
    const { data: existing } = await supabase
      .from('municipalities')
      .select('id')
      .eq('name', muni.name)
      .eq('province', muni.state)
      .eq('country', 'USA')
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    // Insert new municipality
    const { error } = await supabase
      .from('municipalities')
      .insert({
        name: muni.name,
        province: muni.state,
        country: 'USA',
        population: muni.population,
        municipality_type: muni.municipality_type || 'City',
        scan_status: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error(`❌ ${muni.name}, ${muni.state} - Failed:`, error.message);
      failed++;
    } else {
      imported++;
      if (imported % 100 === 0) {
        console.log(`  Progress: ${imported} imported...`);
      }
    }
  }

  console.log('\n==========================================');
  console.log('Summary:');
  console.log(`  ✅ Imported: ${imported}`);
  console.log(`  ⏭️  Skipped (already exists): ${skipped}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📊 Total in CSV: ${municipalities.length}`);
  console.log('\nBy State:');
  Object.entries(byState)
    .sort(([, a], [, b]) => b - a)
    .forEach(([state, count]) => {
      console.log(`  - ${state}: ${count}`);
    });
  console.log('==========================================\n');

  if (imported > 0) {
    console.log('Next step: Find minutes URLs with:');
    console.log('  npm run find-usa-minutes-urls -- --state [StateName] --limit 50\n');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let csvPath: string | undefined;
let minPopulation = 0;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--min-population' && args[i + 1]) {
    minPopulation = parseInt(args[++i], 10);
  } else if (!csvPath) {
    csvPath = args[i];
  }
}

if (!csvPath) {
  console.error('Usage: npm run import-usa-municipalities -- path/to/municipalities.csv [--min-population 10000]');
  console.error('\nSupported CSV formats:');
  console.error('1. Simple: name,state,population,municipality_type');
  console.error('2. uscities.csv: "name","state_name","population","type"');
  console.error('\nExamples:');
  console.error('  npm run import-usa-municipalities -- uscities.csv');
  console.error('  npm run import-usa-municipalities -- uscities.csv --min-population 50000');
  process.exit(1);
}

importMunicipalities(csvPath, minPopulation).catch(console.error);
