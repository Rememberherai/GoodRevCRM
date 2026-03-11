#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { findMeetingDocuments, fetchMeetingContent } from '../lib/municipal-scanner/meeting-finder';
import { SCANNER_CONFIG } from '../lib/municipal-scanner/config';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TestResult {
  municipality: string;
  province: string;
  minutesUrl: string;
  documentsFound: number;
  documentTypes: { pdf: number; html: number };
  sampleUrls: string[];
  issuesFound: string[];
  passedValidation: boolean;
}

/**
 * Validates if a URL looks like an actual meeting document
 */
function validateMeetingUrl(url: string): { valid: boolean; reason?: string } {
  const lowerUrl = url.toLowerCase();

  // Good patterns - actual meeting documents
  const goodPatterns = [
    /meeting\.aspx\?id=/i,           // eSCRIBE meetings
    /\.pdf$/i,                        // PDF files
    /agenda.*\d{4}/i,                 // Agendas with years
    /minutes.*\d{4}/i,                // Minutes with years
    /\d{4}-\d{2}-\d{2}/,             // Date in URL
    /council.*meeting/i,              // Council meeting pages
  ];

  // Bad patterns - not meeting documents
  const badPatterns = [
    /\/environment$/i,                // Generic environment page
    /\/waste$/i,                      // Generic waste page
    /\/water$/i,                      // Generic water page
    /\/utilities$/i,                  // Generic utilities page
    /formcenter/i,                    // Service request forms
    /zero-waste-action-plan/i,       // Policy documents
    /master-plan/i,                   // Master plans
    /requirements-for-building/i,     // Building requirements
    /utility-fees$/i,                 // Fee schedules
  ];

  // Check if it matches any bad pattern
  for (const pattern of badPatterns) {
    if (pattern.test(url)) {
      return { valid: false, reason: `Matches bad pattern: ${pattern.source}` };
    }
  }

  // Check if it matches any good pattern
  for (const pattern of goodPatterns) {
    if (pattern.test(url)) {
      return { valid: true };
    }
  }

  // If no patterns match, it's suspicious
  return { valid: false, reason: 'No recognized meeting document patterns' };
}

async function testMunicipality(municipality: any): Promise<TestResult> {
  const result: TestResult = {
    municipality: municipality.name,
    province: municipality.province,
    minutesUrl: municipality.minutes_url,
    documentsFound: 0,
    documentTypes: { pdf: 0, html: 0 },
    sampleUrls: [],
    issuesFound: [],
    passedValidation: true,
  };

  console.log(`\n[${ municipality.name}, ${municipality.province}]`);
  console.log(`  📄 Calendar URL: ${municipality.minutes_url}`);

  try {
    // Find meeting documents
    const meetingDocs = await findMeetingDocuments(
      municipality.minutes_url,
      SCANNER_CONFIG.dateRangeMonths
    );

    result.documentsFound = meetingDocs.length;

    // Count types
    meetingDocs.forEach(doc => {
      result.documentTypes[doc.type]++;
    });

    console.log(`  📊 Found ${meetingDocs.length} documents (${result.documentTypes.pdf} PDFs, ${result.documentTypes.html} HTML)`);

    // Validate documents
    const sampleSize = Math.min(5, meetingDocs.length);
    for (let i = 0; i < sampleSize; i++) {
      const doc = meetingDocs[i];
      result.sampleUrls.push(doc.url);

      const validation = validateMeetingUrl(doc.url);
      if (!validation.valid) {
        const issue = `Invalid URL [${i + 1}]: ${doc.url.substring(0, 80)}... - ${validation.reason}`;
        result.issuesFound.push(issue);
        result.passedValidation = false;
      }
    }

    // Try fetching first document
    if (meetingDocs.length > 0) {
      console.log(`  🔍 Testing first document fetch...`);
      const firstDoc = meetingDocs[0];
      const content = await fetchMeetingContent(firstDoc);

      if (!content || content.length < 100) {
        result.issuesFound.push(`First document has insufficient content (${content?.length || 0} chars)`);
        result.passedValidation = false;
        console.log(`     ❌ Failed - insufficient content`);
      } else {
        console.log(`     ✅ Success - ${content.length.toLocaleString()} characters extracted`);

        // Check if content looks like a meeting document
        const contentLower = content.toLowerCase();
        const hasMeetingKeywords =
          contentLower.includes('council') ||
          contentLower.includes('meeting') ||
          contentLower.includes('agenda') ||
          contentLower.includes('minutes') ||
          contentLower.includes('motion');

        if (!hasMeetingKeywords) {
          result.issuesFound.push('Document content doesn\'t contain typical meeting keywords');
          result.passedValidation = false;
        }
      }
    }

    // Report issues
    if (result.issuesFound.length > 0) {
      console.log(`  ⚠️  Issues Found:`);
      result.issuesFound.forEach(issue => {
        console.log(`     - ${issue}`);
      });
    } else {
      console.log(`  ✅ All validations passed`);
    }

  } catch (error: any) {
    result.issuesFound.push(`Error: ${error.message}`);
    result.passedValidation = false;
    console.log(`  ❌ Error: ${error.message}`);
  }

  return result;
}

async function main() {
  console.log(`\n🧪 Meeting Finder Validation Test`);
  console.log('='.repeat(70));
  console.log(`Testing meeting document detection quality\n`);

  // Test municipalities from different systems
  const testMunicipalities = [
    { name: 'Calgary', province: 'Alberta' },          // eSCRIBE system
    { name: 'Banff', province: 'Alberta' },            // Custom system
    { name: 'Regina', province: 'Saskatchewan' },      // Different platform
    { name: 'Charlottetown', province: 'Prince Edward Island' }, // PEI system
  ];

  const results: TestResult[] = [];

  for (const testMuni of testMunicipalities) {
    const { data: municipality } = await supabase
      .from('municipalities')
      .select('*')
      .eq('name', testMuni.name)
      .eq('province', testMuni.province)
      .single();

    if (!municipality || !municipality.minutes_url) {
      console.log(`\n[${testMuni.name}, ${testMuni.province}]`);
      console.log(`  ⚠️  No minutes URL found - skipping`);
      continue;
    }

    const result = await testMunicipality(municipality);
    results.push(result);

    // Delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Print summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.passedValidation).length;
  const failed = results.filter(r => !r.passedValidation).length;
  const totalDocs = results.reduce((sum, r) => sum + r.documentsFound, 0);
  const totalPdfs = results.reduce((sum, r) => sum + r.documentTypes.pdf, 0);
  const totalHtml = results.reduce((sum, r) => sum + r.documentTypes.html, 0);

  console.log(`\nMunicipalities Tested: ${results.length}`);
  console.log(`Passed Validation: ${passed} ✅`);
  console.log(`Failed Validation: ${failed} ❌`);
  console.log(`\nTotal Documents Found: ${totalDocs}`);
  console.log(`  - PDFs: ${totalPdfs}`);
  console.log(`  - HTML: ${totalHtml}`);

  if (failed > 0) {
    console.log('\n\n' + '='.repeat(70));
    console.log('⚠️  FAILED VALIDATIONS');
    console.log('='.repeat(70));

    results.filter(r => !r.passedValidation).forEach(result => {
      console.log(`\n${result.municipality}, ${result.province}`);
      console.log(`URL: ${result.minutesUrl}`);
      console.log(`Documents Found: ${result.documentsFound}`);
      console.log(`Issues:`);
      result.issuesFound.forEach(issue => {
        console.log(`  - ${issue}`);
      });
      if (result.sampleUrls.length > 0) {
        console.log(`Sample URLs:`);
        result.sampleUrls.slice(0, 3).forEach((url, idx) => {
          console.log(`  ${idx + 1}. ${url}`);
        });
      }
    });
  }

  console.log('\n\n' + '='.repeat(70));
  if (failed === 0) {
    console.log('✅ All tests passed! Meeting finder is working correctly.');
    console.log('   Ready to run full municipal scan.');
  } else {
    console.log('⚠️  Some tests failed. Review issues above.');
    console.log('   Meeting finder may need adjustments before running full scan.');
  }
  console.log('='.repeat(70));

  // Save detailed results
  const outputFile = `meeting-finder-test-${new Date().toISOString().split('T')[0]}.json`;
  const fs = await import('fs/promises');
  await fs.writeFile(
    outputFile,
    JSON.stringify({
      testedAt: new Date().toISOString(),
      summary: {
        tested: results.length,
        passed,
        failed,
        totalDocs,
        totalPdfs,
        totalHtml,
      },
      results,
    }, null, 2)
  );

  console.log(`\n💾 Detailed results saved to: ${outputFile}\n`);
}

main().catch(console.error);
