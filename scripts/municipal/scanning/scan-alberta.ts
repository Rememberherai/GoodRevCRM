#!/usr/bin/env tsx
/**
 * Alberta Municipal RFP Scanner
 *
 * Scans all Alberta municipalities for waste/water/wastewater RFPs
 * by analyzing council meeting minutes.
 *
 * Usage: npm run scan:alberta
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function scanAlberta() {
  console.log('\n🍁 Alberta Municipal RFP Scanner');
  console.log('====================================\n');
  console.log('Launching scanner for Alberta province...\n');

  try {
    // Run the main scanner with Alberta province filter
    const { stdout, stderr } = await execAsync(
      'npm run scan-municipalities -- --province Alberta',
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

scanAlberta().catch(console.error);
