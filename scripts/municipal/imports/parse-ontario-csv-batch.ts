#!/usr/bin/env tsx
import * as fs from 'fs';
import * as path from 'path';
import { insertMunicipalities } from './discover-province';

const csvPath = path.join(process.cwd(), 'municipalities_-_en.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Split by lines (handle \r\n)
const lines = csvContent.split(/\r?\n/).slice(1); // Skip header
const municipalities = [];

for (const line of lines) {
  if (!line.trim()) continue;

  // Extract URL from href
  const hrefMatch = line.match(/href=""([^"]+)""/);
  if (!hrefMatch) continue;
  const officialWebsite = hrefMatch[1];

  // Extract municipality name from between > and </a>
  const nameMatch = line.match(/>([^<]+)<\/a>/);
  if (!nameMatch) continue;
  const name = nameMatch[1].trim();

  // Extract municipal status (second field)
  const statusMatch = line.match(/<\/a>",([^,]+),/);
  const municipalStatus = statusMatch ? statusMatch[1].trim() : 'Municipality';

  municipalities.push({
    name: name,
    province: 'Ontario',
    country: 'Canada',
    municipality_type: municipalStatus,
    population: null,
    official_website: officialWebsite,
    minutes_url: null, // Will discover later
    scan_status: 'no_minutes' // Mark as no minutes URL yet
  });
}

console.log(`\n📊 Parsed ${municipalities.length} Ontario municipalities from CSV\n`);
console.log(`⚠️  These municipalities have official websites but NO minutes URLs yet.`);
console.log(`   They will be inserted with scan_status='no_minutes'\n`);

// Show sample
console.log('Sample municipalities:');
municipalities.slice(0, 10).forEach(m => {
  console.log(`   ${m.name} (${m.municipality_type})`);
  console.log(`      ${m.official_website}`);
});

console.log(`\n📥 Inserting all ${municipalities.length} municipalities...`);

// Insert all municipalities
insertMunicipalities(municipalities);
