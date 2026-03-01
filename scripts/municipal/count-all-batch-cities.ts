#!/usr/bin/env tsx
// Count total cities in all batch files

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

let totalCities = 0;
const cityCounts: { [key: string]: number } = {};

for (const file of batchFiles) {
  try {
    const content = readFileSync(join('scripts', file), 'utf-8');
    
    // Count occurrences of { name: pattern
    const matches = content.match(/\{\s*name:\s*'/g);
    const count = matches ? matches.length : 0;
    
    cityCounts[file] = count;
    totalCities += count;
    
    console.log(`${file}: ${count} cities`);
  } catch (error: any) {
    console.log(`${file}: NOT FOUND or ERROR - ${error.message}`);
  }
}

console.log(`\n================================`);
console.log(`Total cities in all batches: ${totalCities}`);
console.log(`Expected database count: ~${totalCities} (minus any duplicates/not found)`);
console.log(`Actual database count: 584`);
console.log(`Discrepancy: ${totalCities - 584}`);
console.log(`================================\n`);
