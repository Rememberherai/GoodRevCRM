#!/usr/bin/env tsx
/**
 * Nova Scotia Municipal RFP Scanner
 *
 * Scans all Nova Scotia municipalities for waste/water/wastewater RFPs
 * by analyzing council meeting minutes.
 *
 * Usage: npm run scan:nova-scotia
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function scanNovaScotia() {
  console.log('\n🍁 Nova Scotia Municipal RFP Scanner');
  console.log('====================================\n');
  console.log('Launching scanner for Nova Scotia province...\n');

  try {
    // Run the main scanner with Nova Scotia province filter
    const { stdout, stderr } = await execAsync(
      'npm run scan-municipalities -- --province "Nova Scotia"',
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

scanNovaScotia().catch(console.error);
