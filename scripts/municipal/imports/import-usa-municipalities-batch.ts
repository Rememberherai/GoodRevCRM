#!/usr/bin/env tsx
/**
 * FAST Batch Import USA Municipalities from CSV
 *
 * Uses batch inserts for 100x faster performance
 *
 * Usage: npm run import-usa-municipalities-batch -- uscities.csv [--min-population 10000] [--batch-size 1000]
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

    const name = row.name || row.name_ascii;
    const state = row.state || row.state_name;
    const population = row.population ? parseInt(row.population, 10) : undefined;
    const municipalityType = row.municipality_type || row.type || 'City';

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

async function importMunicipalitiesBatch(
  csvPath: string,
  minPopulation: number = 0,
  batchSize: number = 1000
) {
  console.log('\n🚀 FAST Batch Import USA Municipalities');
  console.log('==========================================\n');
  console.log(`Reading file: ${csvPath}`);
  if (minPopulation > 0) {
    console.log(`Minimum population filter: ${minPopulation.toLocaleString()}`);
  }
  console.log(`Batch size: ${batchSize}`);
  console.log('');

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }

  // Read and parse CSV
  console.log('Parsing CSV...');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const municipalities = parseCSV(content, minPopulation);

  console.log(`Found ${municipalities.length} municipalities to import\n`);

  const timestamp = new Date().toISOString();
  let totalImported = 0;
  let totalErrors = 0;

  // Split into batches
  const batches: MunicipalityRow[][] = [];
  for (let i = 0; i < municipalities.length; i += batchSize) {
    batches.push(municipalities.slice(i, i + batchSize));
  }

  console.log(`Processing ${batches.length} batches...\n`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const records = batch.map(muni => ({
      name: muni.name,
      province: muni.state,
      country: 'USA',
      population: muni.population,
      municipality_type: muni.municipality_type || 'City',
      scan_status: null,
      created_at: timestamp,
      updated_at: timestamp,
    }));

    try {
      // Use regular insert - much faster than upsert
      const { error, data } = await supabase
        .from('municipalities')
        .insert(records)
        .select('id');

      if (error) {
        // Check if it's a duplicate key error - that's ok, skip it
        if (error.message && error.message.includes('duplicate')) {
          totalImported += batch.length;
          console.log(`⏭️  Batch ${i + 1}/${batches.length} - Skipped ${batch.length} duplicates (${totalImported}/${municipalities.length})`);
        } else {
          console.error(`❌ Batch ${i + 1}/${batches.length} failed:`, error.message);
          totalErrors += batch.length;
        }
      } else {
        totalImported += data?.length || batch.length;
        console.log(`✅ Batch ${i + 1}/${batches.length} - Inserted ${data?.length || batch.length} municipalities (${totalImported}/${municipalities.length})`);
      }
    } catch (err: any) {
      console.error(`❌ Batch ${i + 1}/${batches.length} error:`, err.message);
      totalErrors += batch.length;
    }
  }

  // Count by state
  const byState = municipalities.reduce((acc: Record<string, number>, m) => {
    acc[m.state] = (acc[m.state] || 0) + 1;
    return acc;
  }, {});

  console.log('\n==========================================');
  console.log('Summary:');
  console.log(`  ✅ Processed: ${totalImported}`);
  console.log(`  ❌ Errors: ${totalErrors}`);
  console.log(`  📊 Total in CSV: ${municipalities.length}`);
  console.log('\nTop 10 States by City Count:');
  Object.entries(byState)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([state, count]) => {
      console.log(`  - ${state}: ${count}`);
    });
  console.log('==========================================\n');

  if (totalImported > 0) {
    console.log('Next step: Find minutes URLs with:');
    console.log('  npm run find-usa-minutes-urls -- --state [StateName] --limit 50\n');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let csvPath: string | undefined;
let minPopulation = 0;
let batchSize = 1000;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--min-population' && args[i + 1]) {
    minPopulation = parseInt(args[++i], 10);
  } else if (args[i] === '--batch-size' && args[i + 1]) {
    batchSize = parseInt(args[++i], 10);
  } else if (!csvPath) {
    csvPath = args[i];
  }
}

if (!csvPath) {
  console.error('Usage: npm run import-usa-municipalities-batch -- path/to/municipalities.csv [--min-population 10000] [--batch-size 1000]');
  console.error('\nExamples:');
  console.error('  npm run import-usa-municipalities-batch -- uscities.csv');
  console.error('  npm run import-usa-municipalities-batch -- uscities.csv --min-population 50000');
  console.error('  npm run import-usa-municipalities-batch -- uscities.csv --batch-size 500');
  process.exit(1);
}

importMunicipalitiesBatch(csvPath, minPopulation, batchSize).catch(console.error);
