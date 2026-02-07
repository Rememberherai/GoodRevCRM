#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { extractRfpsFromMinutes, delay } from '../lib/municipal-scanner/ai-extractor';
import { findMeetingDocuments, fetchMeetingContent } from '../lib/municipal-scanner/meeting-finder';
import { ScanLogger } from '../lib/municipal-scanner/logger';
import { SCANNER_CONFIG } from '../lib/municipal-scanner/config';
import type { Municipality, ScanOptions, ScanResult, ScanSummary, ExtractedRfp } from '../lib/municipal-scanner/types';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const logger = new ScanLogger();

// Parse command line arguments
function parseArgs(): ScanOptions {
  const args = process.argv.slice(2);
  const options: ScanOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--province' && args[i + 1]) {
      options.province = args[++i];
    } else if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[++i], 10);
    } else if (arg === '--retry-failed') {
      options.retryFailed = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

async function getMunicipalitiesToScan(options: ScanOptions): Promise<Municipality[]> {
  let query = supabase
    .from('municipalities')
    .select('*')
    .not('minutes_url', 'is', null);

  if (options.province) {
    query = query.eq('province', options.province);
  }

  if (options.retryFailed) {
    query = query.eq('scan_status', 'failed');
  } else {
    query = query.in('scan_status', ['pending', 'failed']);
  }

  query = query.order('province').order('name');

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load municipalities: ${error.message}`);
  }

  return data || [];
}

async function findOrCreateOrganization(
  municipality: Municipality
): Promise<string | null> {
  // Check if organization exists
  const { data: existing } = await supabase
    .from('organizations')
    .select('id')
    .ilike('name', `%${municipality.name}%`)
    .eq('address_state', municipality.province)
    .eq('project_id', SCANNER_CONFIG.projectId)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new organization
  const { data: newOrg, error } = await supabase
    .from('organizations')
    .insert({
      project_id: SCANNER_CONFIG.projectId,
      name: `${municipality.name} - ${municipality.province}`,
      address_city: municipality.name,
      address_state: municipality.province,
      address_country: 'Canada',
      industry: 'Government',
      description: `Municipal government - ${municipality.municipality_type || 'municipality'}`,
      website: municipality.official_website,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Error creating organization: ${error.message}`);
    return null;
  }

  return newOrg.id;
}

async function scanMunicipality(
  municipality: Municipality,
  index: number,
  total: number,
  dryRun: boolean
): Promise<ScanResult> {
  const startedAt = new Date();
  const result: ScanResult = {
    municipalityId: municipality.id,
    municipalityName: municipality.name,
    province: municipality.province,
    status: 'success',
    minutesFetched: 0,
    rfpsDetected: 0,
    rfpsCreated: 0,
    startedAt,
    completedAt: new Date(),
  };

  logger.logMunicipalityStart(index, total, municipality.name, municipality.province);

  if (!municipality.minutes_url) {
    logger.logWarning('No minutes URL');
    result.status = 'no_minutes';
    result.completedAt = new Date();
    return result;
  }

  logger.logMinutesUrl(municipality.minutes_url);

  try {
    // Update scan status
    if (!dryRun) {
      await supabase
        .from('municipalities')
        .update({ scan_status: 'scanning' })
        .eq('id', municipality.id);
    }

    // STEP 1: Find all meeting document links from the calendar page
    console.log(`  🔍 Finding meeting documents...`);
    const meetingDocs = await findMeetingDocuments(
      municipality.minutes_url,
      SCANNER_CONFIG.dateRangeMonths
    );

    if (meetingDocs.length === 0) {
      logger.logWarning('No meeting documents found on calendar page');
      result.status = 'no_minutes';
      result.completedAt = new Date();
      return result;
    }

    result.minutesFetched = meetingDocs.length;
    const allExtractedRfps: ExtractedRfp[] = [];

    // STEP 2: Fetch and analyze each meeting document
    for (let i = 0; i < meetingDocs.length; i++) {
      const meeting = meetingDocs[i];
      console.log(`  📄 [${i + 1}/${meetingDocs.length}] Fetching ${meeting.type.toUpperCase()}: ${meeting.url.substring(0, 70)}...`);

      // Fetch meeting content
      const textContent = await fetchMeetingContent(meeting);

      if (!textContent || textContent.length < 100) {
        console.log(`    ⚠️  Skipping - too little content`);
        continue;
      }

      console.log(`    📝 Extracted ${textContent.length.toLocaleString()} characters`);

      // AI analysis
      console.log(`    🤖 AI analyzing for waste/water RFPs...`);
      const extractedRfps = await extractRfpsFromMinutes(
        textContent,
        municipality.name,
        municipality.province
      );

      if (extractedRfps.length > 0) {
        console.log(`    ✅ Found ${extractedRfps.length} potential RFP(s)!`);
        // Attach the meeting URL to each RFP
        extractedRfps.forEach(rfp => {
          rfp.source_meeting_url = meeting.url;
        });
        allExtractedRfps.push(...extractedRfps);
      } else {
        console.log(`    ⚪ No RFPs in this document`);
      }

      // Small delay between documents to be polite
      if (i < meetingDocs.length - 1) {
        await delay(1000);
      }
    }

    result.rfpsDetected = allExtractedRfps.length;
    console.log(`\n  📊 Total RFPs found across all meetings: ${allExtractedRfps.length}`);

    if (allExtractedRfps.length === 0) {
      console.log(`  ⚠️  No waste/water RFPs found in any meetings\n`);

      if (!dryRun) {
        await supabase
          .from('municipalities')
          .update({
            last_scanned_at: new Date().toISOString(),
            scan_status: 'success',
          })
          .eq('id', municipality.id);
      }

      result.completedAt = new Date();
      return result;
    }

    // Find or create organization
    const orgId = dryRun ? 'dry-run-org-id' : await findOrCreateOrganization(municipality);

    if (!orgId) {
      throw new Error('Failed to create/find organization');
    }

    // Insert RFPs with deduplication
    console.log(`  💾 Inserting ${allExtractedRfps.length} RFPs into database...\n`);

    // Group RFPs by title to track mentions
    const rfpsByTitle = new Map<string, ExtractedRfp[]>();
    for (const rfp of allExtractedRfps) {
      const existing = rfpsByTitle.get(rfp.title) || [];
      existing.push(rfp);
      rfpsByTitle.set(rfp.title, existing);
    }

    for (const [title, rfpMentions] of rfpsByTitle.entries()) {
      // Use the first mention as the primary data, but track all mentions
      const primaryRfp = rfpMentions[0];
      const mentionCount = rfpMentions.length;

      if (dryRun) {
        if (mentionCount > 1) {
          logger.logRfpCreated(primaryRfp.title, primaryRfp.due_date, primaryRfp.estimated_value);
          console.log(`       (mentioned in ${mentionCount} meetings)`);
        } else {
          logger.logRfpCreated(primaryRfp.title, primaryRfp.due_date, primaryRfp.estimated_value);
        }
        result.rfpsCreated++;
        continue;
      }

      // Check if this RFP already exists in the database
      const { data: existingRfp } = await supabase
        .from('rfps')
        .select('id, custom_fields')
        .eq('project_id', SCANNER_CONFIG.projectId)
        .eq('organization_id', orgId)
        .eq('title', title)
        .maybeSingle();

      if (existingRfp) {
        // RFP already exists - update mention count
        const currentMentionCount = (existingRfp.custom_fields as any)?.mention_count || 1;
        const newMentionCount = currentMentionCount + mentionCount;

        await supabase
          .from('rfps')
          .update({
            custom_fields: {
              ...(existingRfp.custom_fields as any),
              mention_count: newMentionCount,
              last_mentioned_date: rfpMentions[rfpMentions.length - 1].meeting_date,
            },
          })
          .eq('id', existingRfp.id);

        console.log(`     ⚪ "${title}" (already exists, updated mention count: ${newMentionCount})`);
        continue;
      }

      // New RFP - insert it
      // Determine source based on opportunity type
      const source = primaryRfp.opportunity_type === 'formal_rfp'
        ? 'municipal_rfp'
        : 'municipal_minutes';

      // Collect all meeting URLs where this was mentioned
      const meetingUrls = rfpMentions.map(m => m.source_meeting_url).filter(Boolean);
      const meetingDates = rfpMentions.map(m => m.meeting_date).filter(Boolean);

      const { error: rfpError } = await supabase
        .from('rfps')
        .insert({
          project_id: SCANNER_CONFIG.projectId,
          organization_id: orgId,
          title: primaryRfp.title,
          description: primaryRfp.description,
          due_date: primaryRfp.due_date,
          estimated_value: primaryRfp.estimated_value,
          currency: primaryRfp.currency || 'CAD',
          status: 'identified',
          submission_method: primaryRfp.submission_method,
          submission_email: primaryRfp.contact_email,
          custom_fields: {
            country: 'Canada',
            region: municipality.province,
            source: source,
            opportunity_type: primaryRfp.opportunity_type,
            calendar_url: municipality.minutes_url,
            meeting_url: primaryRfp.source_meeting_url,
            meeting_date: primaryRfp.meeting_date,
            committee_name: primaryRfp.committee_name,
            agenda_item: primaryRfp.agenda_item,
            excerpt: primaryRfp.excerpt,
            ai_confidence: primaryRfp.confidence,
            mention_count: mentionCount,
            all_meeting_urls: meetingUrls,
            all_meeting_dates: meetingDates,
          },
        });

      if (rfpError) {
        logger.logError(`Failed to insert RFP "${primaryRfp.title}": ${rfpError.message}`);
      } else {
        if (mentionCount > 1) {
          logger.logRfpCreated(primaryRfp.title, primaryRfp.due_date, primaryRfp.estimated_value);
          console.log(`       (mentioned in ${mentionCount} meetings)`);
        } else {
          logger.logRfpCreated(primaryRfp.title, primaryRfp.due_date, primaryRfp.estimated_value);
        }
        result.rfpsCreated++;
      }
    }

    // Update municipality stats
    if (!dryRun) {
      await supabase
        .from('municipalities')
        .update({
          rfps_found_count: result.rfpsCreated,
          last_scanned_at: new Date().toISOString(),
          scan_status: 'success',
        })
        .eq('id', municipality.id);
    }

    logger.logSuccess();

  } catch (error: any) {
    result.status = 'failed';
    result.error = error.message;
    logger.logError(error.message);

    if (!dryRun) {
      await supabase
        .from('municipalities')
        .update({
          scan_status: 'failed',
          scan_error: error.message,
        })
        .eq('id', municipality.id);
    }
  }

  result.completedAt = new Date();
  return result;
}

async function main() {
  const options = parseArgs();

  logger.logHeader();

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No data will be written to database\n');
  }

  // Load municipalities to scan
  const municipalities = await getMunicipalitiesToScan(options);

  if (municipalities.length === 0) {
    console.log('No municipalities to scan. All municipalities have been scanned or no municipalities match the criteria.');
    return;
  }

  logger.logConfig({
    projectId: SCANNER_CONFIG.projectId,
    totalMunicipalities: municipalities.length,
    dateRange: SCANNER_CONFIG.dateRangeMonths,
  });

  const results: ScanResult[] = [];
  const provinceRfpCounts = new Map<string, number>();
  let organizationsCreated = 0;

  for (let i = 0; i < municipalities.length; i++) {
    const municipality = municipalities[i];

    const result = await scanMunicipality(
      municipality,
      i + 1,
      municipalities.length,
      options.dryRun || false
    );

    results.push(result);

    // Track province counts
    const currentCount = provinceRfpCounts.get(municipality.province) || 0;
    provinceRfpCounts.set(municipality.province, currentCount + result.rfpsCreated);

    // Be polite - delay between requests
    if (i < municipalities.length - 1) {
      await delay(SCANNER_CONFIG.requestDelayMs);
    }
  }

  // Generate summary
  const summary: ScanSummary = {
    municipalitiesScanned: results.length,
    rfpsDetected: results.reduce((sum, r) => sum + r.rfpsDetected, 0),
    rfpsCreated: results.reduce((sum, r) => sum + r.rfpsCreated, 0),
    organizationsCreated,
    errors: results.filter(r => r.status === 'failed').length,
    topProvinces: Array.from(provinceRfpCounts.entries())
      .map(([province, count]) => ({ province, count }))
      .filter(p => p.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    duration: Date.now() - results[0].startedAt.getTime(),
  };

  logger.logSummary(summary);
}

main().catch(console.error);
