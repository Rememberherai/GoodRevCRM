#!/usr/bin/env tsx
/**
 * USA Municipal Meeting Minutes URL Finder
 *
 * Automatically finds meeting minutes URLs for USA municipalities
 * using a combination of:
 * 1. Known platform URL patterns (Granicus, Legistar, CivicPlus, CivicClerk)
 * 2. Web search + AI validation
 * 3. Official website crawling
 *
 * Usage: npm run find-usa-minutes-urls -- --state Alabama --limit 10
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { getOpenRouterClient } from '../lib/openrouter/client';
import { delay } from '../lib/municipal-scanner/ai-extractor';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Municipality {
  id: string;
  name: string;
  province: string; // US state name stored in province field
  official_website?: string;
  minutes_url?: string;
  country: string;
}

interface URLFinderOptions {
  state?: string;
  limit?: number;
  skipKnownPatterns?: boolean;
  minPopulation?: number;
}

// Known platform URL patterns
const KNOWN_PLATFORMS = {
  legistar: (cityName: string, state: string) => {
    const slug = cityName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '');
    return `https://${slug}${state.toLowerCase()}.legistar.com/`;
  },
  granicus: (cityName: string, state: string) => {
    const slug = cityName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '');
    return [
      `https://${slug}.granicus.com/ViewPublisher.php?view_id=1`,
      `https://${slug}${state.toLowerCase()}.granicus.com/ViewPublisher.php?view_id=1`,
    ];
  },
  civicclerk: (cityName: string, state: string) => {
    const slug = cityName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '');
    return `https://${slug}${state.toLowerCase()}.portal.civicclerk.com/`;
  },
};

/**
 * Try known platform URL patterns first
 */
async function tryKnownPatterns(municipality: Municipality): Promise<string | null> {
  const citySlug = municipality.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '');
  const stateSlug = municipality.province.toLowerCase().replace(/\s+/g, '');

  const urlsToTry = [
    // Legistar
    KNOWN_PLATFORMS.legistar(municipality.name, municipality.province),

    // Granicus variations
    ...KNOWN_PLATFORMS.granicus(municipality.name, municipality.province),

    // CivicClerk
    KNOWN_PLATFORMS.civicclerk(municipality.name, municipality.province),

    // CivicPlus Agenda Center patterns
    `https://www.${citySlug}.org/agendacenter`,
    `https://www.${citySlug}.gov/agendacenter`,
    `https://${citySlug}.${stateSlug}.gov/agendacenter`,

    // Generic government sites
    `https://www.${citySlug}.gov/council/meetings`,
    `https://www.${citySlug}.gov/government/council/agendas`,
    `https://www.${citySlug}.org/council/meetings`,
  ];

  console.log(`  Trying ${urlsToTry.length} known URL patterns...`);

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        console.log(`  ✅ Found working URL: ${url}`);
        return url;
      }
    } catch (error) {
      // URL doesn't exist or timed out, continue
    }
    await delay(100); // Small delay to avoid rate limiting
  }

  return null;
}

/**
 * Use AI with web search to find and validate minutes URL
 * Uses Perplexity via OpenRouter for real-time web search
 */
async function findWithAI(municipality: Municipality): Promise<string | null> {
  console.log(`  Using AI web search to find minutes URL...`);

  const prompt = `Search the web and find the ACTUAL working URL for ${municipality.name}, ${municipality.province} city council meeting minutes and agendas.

CRITICAL: Do NOT assume or guess URLs. You MUST search the web and verify the actual URL exists.

Requirements:
1. Search for: "${municipality.name} ${municipality.province} city council agendas minutes meetings"
2. Find the SPECIFIC page with the meeting calendar or minutes archive
3. Do NOT return generic homepages or "about" pages
4. Verify the URL actually works and contains meeting documents
5. Return the EXACT URL you found, not a Legistar URL unless the city actually uses Legistar

Examples of GOOD URLs:
- https://chicityclerkelms.chicago.gov/Meetings/
- https://www.phoenix.gov/cityclerksite/Pages/City-Council-Meetings.aspx
- https://sanantonio.gov/Clerk/Meetings

Examples of BAD URLs (do not return these):
- https://www.cityname.gov (homepage only)
- https://cityname.legistar.com (unless you verified the city actually uses Legistar)

Return ONLY the direct URL, or "NOT_FOUND" if no valid page exists.`;

  try {
    const openrouter = getOpenRouterClient();
    const response = await openrouter.chat(
      [{ role: 'user', content: prompt }],
      {
        // Use Claude 3.5 Sonnet with web search
        model: 'anthropic/claude-3.5-sonnet:beta',
        temperature: 0.1,
        maxTokens: 500,
        // Enable web search for Claude
        provider: {
          allow_fallbacks: false,
          order: ['Anthropic'],
        },
        transforms: ['web-search'],
      }
    );

    const content = response.choices[0]?.message?.content?.trim() || '';

    // Extract URL from response
    const urlMatch = content.match(/https?:\/\/[^\s<>"]+/);
    if (urlMatch && !content.includes('NOT_FOUND')) {
      const url = urlMatch[0];
      console.log(`  🤖 AI web search found URL: ${url}`);
      return url;
    }
  } catch (error) {
    console.error(`  ❌ AI web search failed:`, error);
  }

  return null;
}

/**
 * Find minutes URL for a single municipality
 */
async function findMinutesUrl(municipality: Municipality, skipKnownPatterns: boolean = false): Promise<string | null> {
  console.log(`\n🔍 Finding minutes URL for: ${municipality.name}, ${municipality.province}`);

  // DISABLED: Known patterns produce too many false positives
  // Skip straight to AI web search for accuracy

  // Use AI web search with Perplexity (has real-time web access)
  const aiUrl = await findWithAI(municipality);
  if (aiUrl) {
    return aiUrl;
  }

  console.log(`  ❌ Could not find minutes URL`);
  return null;
}

/**
 * Update municipality record with found URL
 */
async function updateMunicipalityUrl(municipalityId: string, minutesUrl: string) {
  const { error } = await supabase
    .from('municipalities')
    .update({
      minutes_url: minutesUrl,
      scan_status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', municipalityId);

  if (error) {
    console.error(`  Failed to update database:`, error.message);
  } else {
    console.log(`  💾 Saved to database`);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const options: URLFinderOptions = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--state' && args[i + 1]) {
      options.state = args[++i];
    } else if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[++i], 10);
    } else if (args[i] === '--min-population' && args[i + 1]) {
      options.minPopulation = parseInt(args[++i], 10);
    } else if (args[i] === '--skip-known-patterns') {
      options.skipKnownPatterns = true;
    }
  }

  console.log('\n🇺🇸 USA Municipal Minutes URL Finder');
  console.log('====================================\n');

  if (options.state) {
    console.log(`State filter: ${options.state}`);
  }
  if (options.minPopulation) {
    console.log(`Minimum population: ${options.minPopulation.toLocaleString()}`);
  }
  if (options.limit) {
    console.log(`Limit: ${options.limit} municipalities`);
  }
  console.log('');

  // Get municipalities without minutes URLs
  let query = supabase
    .from('municipalities')
    .select('*')
    .eq('country', 'USA')
    .is('minutes_url', null);

  if (options.state) {
    query = query.eq('province', options.state);
  }

  if (options.minPopulation) {
    query = query.gte('population', options.minPopulation);
  }

  query = query.order('population', { ascending: false });

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data: municipalities, error } = await query;

  if (error) {
    console.error('Failed to load municipalities:', error.message);
    process.exit(1);
  }

  if (!municipalities || municipalities.length === 0) {
    console.log('No municipalities found matching criteria.');
    process.exit(0);
  }

  console.log(`Found ${municipalities.length} municipalities to process\n`);

  let found = 0;
  let notFound = 0;

  for (const municipality of municipalities) {
    const minutesUrl = await findMinutesUrl(municipality, options.skipKnownPatterns);

    if (minutesUrl) {
      await updateMunicipalityUrl(municipality.id, minutesUrl);
      found++;
    } else {
      notFound++;
    }

    // Delay between municipalities to avoid rate limiting
    await delay(2000);
  }

  console.log('\n====================================');
  console.log('Summary:');
  console.log(`  ✅ Found: ${found}`);
  console.log(`  ❌ Not found: ${notFound}`);
  console.log(`  📊 Success rate: ${((found / municipalities.length) * 100).toFixed(1)}%`);
  console.log('====================================\n');
}

main().catch(console.error);
