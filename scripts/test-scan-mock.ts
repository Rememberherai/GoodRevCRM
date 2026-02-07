import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROJECT_ID = '92352069-9031-4f9c-a89b-e09dc51d2d16'; // Test project

async function testWithMockRfp() {
  console.log('🇨🇦 Municipal RFP Scanner - Mock Test\n');
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
  console.log(`  📄 Simulating AI extraction...`);

  // Mock extracted RFP (simulating what AI would return)
  const mockExtractedRfps = [
    {
      title: 'Wastewater Treatment Plant Upgrade - Phase 2',
      description: 'The Halifax Regional Municipality is seeking proposals for the upgrade of the Dartmouth Wastewater Treatment Plant, including installation of new UV disinfection systems, membrane filtration upgrades, and control system modernization. The project includes design, supply, installation, and commissioning of all equipment.',
      due_date: '2026-04-15',
      estimated_value: 8500000,
      currency: 'CAD',
      submission_method: 'portal',
      contact_email: 'procurement@halifax.ca',
      confidence: 92
    },
    {
      title: 'Municipal Solid Waste Collection Services Contract',
      description: 'Request for Proposals for municipal solid waste and recycling collection services for the Halifax Regional Municipality. The contract will cover all residential collection services including garbage, recycling, and organics collection for a 5-year term.',
      due_date: '2026-03-30',
      estimated_value: 12000000,
      currency: 'CAD',
      submission_method: 'email',
      contact_email: 'solidwaste@halifax.ca',
      confidence: 88
    }
  ];

  console.log(`  ✅ Found ${mockExtractedRfps.length} potential RFPs (SIMULATED)\n`);

  const validRfps = mockExtractedRfps.filter(rfp => rfp.confidence >= 70);
  console.log(`  ✓ ${validRfps.length} RFPs meet confidence threshold (>=70)\n`);

  // Create/find organization
  let orgId = null;
  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id')
    .ilike('name', `%${municipality.name}%`)
    .eq('project_id', PROJECT_ID)
    .single();

  if (existingOrg) {
    orgId = existingOrg.id;
    console.log(`  🏢 Using existing organization (ID: ${orgId})`);
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
    console.log(`  🏢 Created new organization (ID: ${orgId})`);
  }

  console.log(`\n  💾 Inserting RFPs into database...\n`);

  // Insert RFPs
  let insertedCount = 0;
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
          minutes_url: 'https://pub-halifax.escribemeetings.com/meeting-jan-2026',
          ai_confidence: rfp.confidence
        }
      });

    if (rfpError) {
      console.error(`     ❌ Error inserting "${rfp.title}":`, rfpError.message);
    } else {
      insertedCount++;
      console.log(`     ✓ "${rfp.title}"`);
      console.log(`       Value: $${rfp.estimated_value?.toLocaleString()} CAD`);
      console.log(`       Due: ${rfp.due_date}`);
      console.log(`       Confidence: ${rfp.confidence}%\n`);
    }
  }

  // Update municipality stats
  await supabase
    .from('municipalities')
    .update({
      rfps_found_count: insertedCount,
      last_scanned_at: new Date().toISOString(),
      scan_status: 'success'
    })
    .eq('id', municipality.id);

  console.log('\n====================================');
  console.log('✅ Test Complete!');
  console.log('====================================\n');
  console.log(`Municipality scanned: Halifax, Nova Scotia`);
  console.log(`RFPs created: ${insertedCount}`);
  console.log(`Organization: ${municipality.name} - ${municipality.province}`);
  console.log(`\n🔗 View RFPs in your CRM:`);
  console.log(`   http://localhost:3000/projects/${PROJECT_ID.substring(0, 8)}.../rfps`);
  console.log(`\n📋 Filter by custom field "source" = "municipal_minutes" to see these RFPs\n`);
}

testWithMockRfp();
