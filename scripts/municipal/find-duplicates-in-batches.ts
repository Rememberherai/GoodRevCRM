#!/usr/bin/env tsx
import { readFileSync } from 'fs';
import { join } from 'path';

const batchFiles = [
  'batch-update-urls-51-100.ts',
  'batch-update-urls-101-150.ts',
  'batch-update-urls-151-200.ts',
  'batch-update-urls-201-220.ts',
  'batch-update-urls-221-250.ts',
  'batch-update-urls-251-280.ts',
  'batch-update-urls-281-320.ts',
  'batch-update-urls-321-350.ts',
  'batch-update-urls-351-380.ts',
  'batch-update-urls-381-410.ts',
  'batch-update-urls-401-430.ts',
  'batch-update-urls-431-460.ts',
  'batch-update-urls-461-500.ts',
  'batch-update-urls-501-600.ts',
  'batch-update-urls-601-700.ts',
  'batch-update-urls-701-750.ts',
];

interface CityKey {
  name: string;
  province: string;
}

function extractCitiesFromBatch(filePath: string): CityKey[] {
  const content = readFileSync(filePath, 'utf-8');
  const cities: CityKey[] = [];

  // Match pattern: { name: 'City Name', province: 'State', url: 'https://...' }
  const regex = /\{\s*name:\s*['"]([^'"]+)['"]\s*,\s*province:\s*['"]([^'"]+)['"]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    cities.push({
      name: match[1],
      province: match[2],
    });
  }

  return cities;
}

console.log('\n🔍 Checking for duplicate cities across all batches...\n');

const cityMap = new Map<string, { count: number; files: string[] }>();
let totalCities = 0;

for (const file of batchFiles) {
  const filePath = join('scripts', file);
  try {
    const cities = extractCitiesFromBatch(filePath);

    for (const city of cities) {
      const key = `${city.name}, ${city.province}`;
      const existing = cityMap.get(key);

      if (existing) {
        existing.count++;
        existing.files.push(file);
      } else {
        cityMap.set(key, { count: 1, files: [file] });
      }

      totalCities++;
    }
  } catch (error: any) {
    console.error(`❌ ${file}: ERROR - ${error.message}`);
  }
}

const duplicates = Array.from(cityMap.entries()).filter(([_, data]) => data.count > 1);

console.log(`📊 Total city entries: ${totalCities}`);
console.log(`📊 Unique cities: ${cityMap.size}`);
console.log(`📊 Duplicate entries: ${duplicates.length}\n`);

if (duplicates.length > 0) {
  console.log(`🔄 DUPLICATE CITIES FOUND:\n`);
  duplicates.forEach(([city, data]) => {
    console.log(`   ${city} - appears ${data.count} times in:`);
    data.files.forEach(f => console.log(`      - ${f}`));
    console.log('');
  });
} else {
  console.log(`✅ No duplicate cities found across batches\n`);
}

console.log(`\n📈 SUMMARY:`);
console.log(`================================`);
console.log(`Total entries in batch files: ${totalCities}`);
console.log(`Unique cities: ${cityMap.size}`);
console.log(`Duplicate count: ${totalCities - cityMap.size}`);
console.log(`================================\n`);
