import type { ScanSummary } from './types';
import { writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export class ScanLogger {
  private logFile: string | null = null;

  constructor(province?: string) {
    // Create logs directory if it doesn't exist
    try {
      mkdirSync('logs', { recursive: true });

      // Create timestamped log file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const provinceSlug = province ? `-${province.toLowerCase().replace(/\s+/g, '-')}` : '';
      this.logFile = join('logs', `scan${provinceSlug}-${timestamp}.log`);

      // Initialize log file
      writeFileSync(this.logFile, '');
    } catch (error) {
      console.error('Warning: Could not create log file:', error);
      this.logFile = null;
    }
  }

  private log(message: string) {
    console.log(message);
    if (this.logFile) {
      try {
        appendFileSync(this.logFile, message + '\n');
      } catch (error) {
        // Silently ignore file write errors
      }
    }
  }

  private logError(message: string) {
    console.error(message);
    if (this.logFile) {
      try {
        appendFileSync(this.logFile, message + '\n');
      } catch (error) {
        // Silently ignore file write errors
      }
    }
  }

  logHeader() {
    this.log('\n🇨🇦 Canadian Municipal RFP Scanner');
    this.log('====================================\n');
    if (this.logFile) {
      this.log(`Log file: ${this.logFile}\n`);
    }
  }

  logConfig(config: { projectId: string; totalMunicipalities: number; dateRange: number }) {
    this.log('Configuration:');
    this.log(`- Project ID: ${config.projectId.substring(0, 8)}...`);
    this.log(`- Total municipalities to scan: ${config.totalMunicipalities}`);
    this.log(`- Date range: Last ${config.dateRange} months\n`);
    this.log('Starting scan...\n');
  }

  logMunicipalityStart(index: number, total: number, name: string, province: string) {
    this.log(`[${index}/${total}] ${name}, ${province}`);
  }

  logMinutesUrl(url: string) {
    this.log(`  📄 Minutes URL: ${url}`);
  }

  logFetching(url: string) {
    this.log(`  📥 Fetching: ${url.substring(0, 60)}...`);
  }

  logTextExtracted(chars: number) {
    this.log(`  📝 Extracted ${chars.toLocaleString()} characters`);
  }

  logAIAnalyzing() {
    this.log(`  🤖 AI analyzing content for waste/water RFPs...`);
  }

  logRfpsFound(count: number) {
    this.log(`  ✅ Found ${count} potential RFPs`);
  }

  logRfpCreated(title: string, dueDate: string | null, value: number | null) {
    this.log(`     ✓ "${title}"`);
    if (value) {
      this.log(`       Value: $${value.toLocaleString()} CAD`);
    }
    if (dueDate) {
      this.log(`       Due: ${dueDate}`);
    }
  }

  logNoRfps() {
    this.log(`  ⚠️  No waste/water RFPs found`);
  }

  logErrorMessage(message: string) {
    this.logError(`  ❌ Error: ${message}`);
  }

  logWarning(message: string) {
    this.log(`  ⚠️  ${message}`);
  }

  logSuccess() {
    this.log(`  💾 Inserted into database\n`);
  }

  logSummary(summary: ScanSummary) {
    const duration = Math.round(summary.duration / 1000 / 60);

    this.log('\n====================================');
    this.log('Scan Complete!');
    this.log('====================================\n');
    this.log('Results:');
    this.log(`✅ Municipalities scanned: ${summary.municipalitiesScanned}`);
    this.log(`📊 RFPs detected: ${summary.rfpsDetected}`);
    this.log(`💾 RFPs created: ${summary.rfpsCreated}`);
    this.log(`🏢 Organizations created: ${summary.organizationsCreated}`);
    this.log(`❌ Errors: ${summary.errors}`);
    this.log(`⏱️  Duration: ${duration} minutes\n`);

    if (summary.topProvinces.length > 0) {
      this.log('Top provinces by RFPs:');
      summary.topProvinces.forEach(({ province, count }) => {
        this.log(`- ${province}: ${count} RFPs`);
      });
      this.log('');
    }

    this.log('View your RFPs in the CRM UI');
    this.log('Filter by custom_fields source: "municipal_minutes"\n');

    if (this.logFile) {
      this.log(`Full log saved to: ${this.logFile}`);
    }
  }
}
