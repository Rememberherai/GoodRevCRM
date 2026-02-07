#!/usr/bin/env tsx
/**
 * Quebec Municipal RFP Scanner
 *
 * Scans all Quebec municipalities for waste/water/wastewater RFPs
 * by analyzing council meeting minutes.
 *
 * Prerequisites: Run `npm run add-quebec-from-csv` first to populate municipalities
 *
 * Usage: npm run scan:quebec
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function scanQuebec() {
  console.log('\n⚜️  Quebec Municipal RFP Scanner');
  console.log('====================================\n');
  console.log('Launching scanner for Quebec province...\n');

  try {
    // Run the main scanner with Quebec province filter
    const { stdout, stderr } = await execAsync(
      'npm run scan-municipalities -- --province Quebec',
      { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer for large output
    );

    console.log(stdout);
    if (stderr) {
      console.error(stderr);
    }
  } catch (error: any) {
    console.error('❌ Scanner error:', error.message);
    if (error.stdout) {
      console.log(error.stdout);
    }
    if (error.stderr) {
      console.error(error.stderr);
    }
    process.exit(1);
  }
}

scanQuebec().catch(console.error);
