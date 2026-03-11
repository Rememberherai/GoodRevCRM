#!/usr/bin/env tsx
import * as fs from 'fs';
import * as path from 'path';
import { insertMunicipalities } from './discover-province';

const csvPath = path.join(process.cwd(), 'municipalities_-_en.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

const lines = csvContent.split('\n').slice(1); // Skip header
const municipalities = [];

for (const line of lines) {
  if (!line.trim()) continue;

  // Parse CSV line - handle quoted fields with commas
  const match = line.match(/"<a[^>]*>([^<]+)<\/a>","([^"]*)","([^"]*)"/);
  if (!match) continue;

  const [, fullName, municipalStatus, geographicArea] = match;

  // Extract municipality name (remove "Township of", "Town of", "City of" suffixes)
  let name = fullName.trim();

  // Extract official website from href
  const hrefMatch = line.match(/href="([^"]+)"/);
  const officialWebsite = hrefMatch ? hrefMatch[1] : null;

  if (!officialWebsite || !name) continue;

  municipalities.push({
    name: name,
    province: 'Ontario',
    country: 'Canada',
    municipality_type: municipalStatus || 'Municipality',
    population: null, // We don't have population data in this CSV
    official_website: officialWebsite,
    minutes_url: null, // Will need to discover these
    scan_status: 'pending'
  });
}

console.log(`\n📊 Parsed ${municipalities.length} Ontario municipalities from CSV`);
console.log(`\n⚠️  Note: This CSV has municipality names and websites, but NO meeting minutes URLs.`);
console.log(`   We'll need to discover the minutes URLs separately.\n`);

// Show sample
console.log('Sample municipalities:');
municipalities.slice(0, 5).forEach(m => {
  console.log(`   ${m.name} - ${m.official_website}`);
});

console.log(`\n💡 Next steps:`);
console.log(`   1. We can insert these ${municipalities.length} municipalities without minutes_url`);
console.log(`   2. Then run a separate process to discover minutes URLs for each`);
console.log(`   3. Or we can use the 26 major Ontario municipalities we already found (with minutes URLs)`);
console.log(`\nShould I insert all ${municipalities.length} municipalities now? (They'll have scan_status='no_minutes' until we find URLs)`);
