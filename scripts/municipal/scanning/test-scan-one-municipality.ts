import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { getOpenRouterClient } from '../lib/openrouter/client';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROJECT_ID = '92352069-9031-4f9c-a89b-e09dc51d2d16'; // Test project

interface ExtractedRfp {
  title: string;
  description: string;
  due_date: string | null;
  estimated_value: number | null;
  currency: string | null;
  submission_method: string | null;
  contact_email: string | null;
  confidence: number;
}

async function extractRfpsFromText(
  minutesText: string,
  municipalityName: string,
  province: string
): Promise<ExtractedRfp[]> {
  const prompt = `You are analyzing municipal meeting minutes to identify procurement opportunities related to:
- Waste management (solid waste, recycling, composting)
- Water treatment (drinking water, water infrastructure)
- Wastewater treatment (sewage, WWTP, collection systems)

Municipality: ${municipalityName}, ${province}

For each RFP, Request for Proposal, bid opportunity, or procurement mentioned, extract:
1. Title/Project Name
2. Description of scope of work
3. Due date / submission deadline (if mentioned)
4. Estimated value or budget (if mentioned)
5. Submission method (email, portal, physical)
6. Any contact information

Return ONLY opportunities that are:
- Active or upcoming (not historical/completed)
- Related to waste/water/wastewater
- Actually procurement opportunities (not just discussion)

Return as JSON array:
{
  "rfps": [
    {
      "title": string,
      "description": string,
      "due_date": string | null,
      "estimated_value": number | null,
      "currency": string | null,
      "submission_method": "email" | "portal" | "physical" | "other" | null,
      "contact_email": string | null,
      "confidence": number
    }
  ]
}

If no RFPs found, return {"rfps": []}.

Meeting Minutes Text:
${minutesText.substring(0, 15000)}`;

  try {
    // Make sure API key is available in environment
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY not found in environment');
    }

    const openrouter = getOpenRouterClient();
    const response = await openrouter.chat(
      [{ role: 'user', content: prompt }],
      {
        model: 'anthropic/claude-3.5-sonnet',
        temperature: 0.3,
        responseFormat: 'json_object'
      }
    );

    const content = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(content);
    return result.rfps || [];
  } catch (error) {
    console.error('AI extraction error:', error);
    return [];
  }
}

async function scanHalifax() {
  console.log('🇨🇦 Municipal RFP Scanner - Test Run\n');
  console.log('====================================\n');

  // Get Halifax municipality
  const { data: municipality, error: municError } = await supabase
    .from('municipalities')
    .select('*')
    .eq('name', 'Halifax')
    .single();

  if (municError || !municipality) {
    console.error('❌ Could not find Halifax in database');
    return;
  }

  console.log(`[1/1] ${municipality.name}, ${municipality.province}`);
  console.log(`  📄 Minutes URL: ${municipality.minutes_url}`);

  // For this test, let's use a sample meeting minutes URL
  const testMeetingUrl = 'https://pub-halifax.escribemeetings.com/Meeting.aspx?Id=4a6b228e-9d53-49d5-88bd-3ca088cabaac&Agenda=Merged&lang=English';

  console.log(`  📥 Fetching meeting from: ${testMeetingUrl}`);

  try {
    const response = await fetch(testMeetingUrl);
    const html = await response.text();

    // Simple text extraction (in production we'd use cheerio)
    const textContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    console.log(`  📝 Extracted ${textContent.length} characters of text`);
    console.log(`  🤖 AI analyzing content for waste/water RFPs...`);

    const extractedRfps = await extractRfpsFromText(
      textContent,
      municipality.name,
      municipality.province
    );

    console.log(`  ✅ Found ${extractedRfps.length} potential RFPs\n`);

    if (extractedRfps.length === 0) {
      console.log('  ⚠️  No RFPs detected in this meeting\n');
      return;
    }

    // Filter by confidence threshold
    const validRfps = extractedRfps.filter(rfp => rfp.confidence >= 70);
    console.log(`  ✓ ${validRfps.length} RFPs meet confidence threshold (>=70)\n`);

    // Create/find organization
    let orgId = null;
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', `${municipality.name} - ${municipality.province}`)
      .eq('project_id', PROJECT_ID)
      .single();

    if (existingOrg) {
      orgId = existingOrg.id;
      console.log(`  🏢 Using existing organization`);
    } else {
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          project_id: PROJECT_ID,
          name: `${municipality.name} - ${municipality.province}`,
          address_city: municipality.name,
          address_state: municipality.province,
          address_country: 'Canada',
          industry: 'Government',
          description: `Municipal government - ${municipality.municipality_type}`,
          website: municipality.official_website
        })
        .select('id')
        .single();

      if (orgError) {
        console.error('  ❌ Error creating organization:', orgError.message);
        return;
      }
      orgId = newOrg.id;
      console.log(`  🏢 Created organization`);
    }

    // Insert RFPs
    for (const rfp of validRfps) {
      const { error: rfpError } = await supabase
        .from('rfps')
        .insert({
          project_id: PROJECT_ID,
          organization_id: orgId,
          title: rfp.title,
          description: rfp.description,
          due_date: rfp.due_date,
          estimated_value: rfp.estimated_value,
          currency: rfp.currency || 'CAD',
          status: 'identified',
          submission_method: rfp.submission_method,
          submission_email: rfp.contact_email,
          custom_fields: {
            country: 'Canada',
            region: municipality.province,
            source: 'municipal_minutes',
            minutes_url: testMeetingUrl,
            ai_confidence: rfp.confidence
          }
        });

      if (rfpError) {
        console.error(`  ❌ Error inserting RFP "${rfp.title}":`, rfpError.message);
      } else {
        console.log(`     ✓ "${rfp.title}" (Confidence: ${rfp.confidence}%)`);
        if (rfp.due_date) {
          console.log(`       Due: ${rfp.due_date}`);
        }
      }
    }

    // Update municipality stats
    await supabase
      .from('municipalities')
      .update({
        rfps_found_count: validRfps.length,
        last_scanned_at: new Date().toISOString(),
        scan_status: 'success'
      })
      .eq('id', municipality.id);

    console.log('\n====================================');
    console.log('Test Complete!');
    console.log('====================================\n');
    console.log(`✅ Successfully scanned Halifax`);
    console.log(`📊 RFPs created: ${validRfps.length}`);
    console.log(`\nView RFPs in your CRM at:`);
    console.log(`/projects/${PROJECT_ID}/rfps`);
    console.log(`\nFilter by source: "municipal_minutes"\n`);

  } catch (error: any) {
    console.error('  ❌ Error:', error.message);
  }
}

scanHalifax();
