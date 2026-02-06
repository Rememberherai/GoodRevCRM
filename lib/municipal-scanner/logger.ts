import type { ScanSummary } from './types';

export class ScanLogger {
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
  }

  logHeader() {
    console.log('\n🇨🇦 Canadian Municipal RFP Scanner');
    console.log('====================================\n');
  }

  logConfig(config: { projectId: string; totalMunicipalities: number; dateRange: number }) {
    console.log('Configuration:');
    console.log(`- Project ID: ${config.projectId.substring(0, 8)}...`);
    console.log(`- Total municipalities to scan: ${config.totalMunicipalities}`);
    console.log(`- Date range: Last ${config.dateRange} months\n`);
    console.log('Starting scan...\n');
  }

  logMunicipalityStart(index: number, total: number, name: string, province: string) {
    console.log(`[${index}/${total}] ${name}, ${province}`);
  }

  logMinutesUrl(url: string) {
    console.log(`  📄 Minutes URL: ${url}`);
  }

  logFetching(url: string) {
    console.log(`  📥 Fetching: ${url.substring(0, 60)}...`);
  }

  logTextExtracted(chars: number) {
    console.log(`  📝 Extracted ${chars.toLocaleString()} characters`);
  }

  logAIAnalyzing() {
    console.log(`  🤖 AI analyzing content for waste/water RFPs...`);
  }

  logRfpsFound(count: number) {
    console.log(`  ✅ Found ${count} potential RFPs`);
  }

  logRfpCreated(title: string, dueDate: string | null, value: number | null) {
    console.log(`     ✓ "${title}"`);
    if (value) {
      console.log(`       Value: $${value.toLocaleString()} CAD`);
    }
    if (dueDate) {
      console.log(`       Due: ${dueDate}`);
    }
  }

  logNoRfps() {
    console.log(`  ⚠️  No waste/water RFPs found`);
  }

  logError(message: string) {
    console.error(`  ❌ Error: ${message}`);
  }

  logWarning(message: string) {
    console.log(`  ⚠️  ${message}`);
  }

  logSuccess() {
    console.log(`  💾 Inserted into database\n`);
  }

  logSummary(summary: ScanSummary) {
    const duration = Math.round(summary.duration / 1000 / 60);

    console.log('\n====================================');
    console.log('Scan Complete!');
    console.log('====================================\n');
    console.log('Results:');
    console.log(`✅ Municipalities scanned: ${summary.municipalitiesScanned}`);
    console.log(`📊 RFPs detected: ${summary.rfpsDetected}`);
    console.log(`💾 RFPs created: ${summary.rfpsCreated}`);
    console.log(`🏢 Organizations created: ${summary.organizationsCreated}`);
    console.log(`❌ Errors: ${summary.errors}`);
    console.log(`⏱️  Duration: ${duration} minutes\n`);

    if (summary.topProvinces.length > 0) {
      console.log('Top provinces by RFPs:');
      summary.topProvinces.forEach(({ province, count }) => {
        console.log(`- ${province}: ${count} RFPs`);
      });
      console.log();
    }

    console.log('View your RFPs in the CRM UI');
    console.log('Filter by custom_fields source: "municipal_minutes"\n');
  }
}
