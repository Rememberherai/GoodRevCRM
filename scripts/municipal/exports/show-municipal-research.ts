import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROJECT_ID = '92352069-9031-4f9c-a89b-e09dc51d2d16';

async function showResearch() {
  // Get RFPs from municipal minutes
  const { data, error } = await supabase
    .from('rfps')
    .select(`
      *,
      organizations (
        id,
        name,
        address_city,
        address_state
      )
    `)
    .eq('project_id', PROJECT_ID)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  // Filter for municipal minutes only
  const municipalRfps = data.filter(rfp =>
    rfp.custom_fields?.source === 'municipal_minutes'
  );

  console.log('🇨🇦 Municipal Meeting Minutes Research Report\n');
  console.log(`Found ${municipalRfps.length} opportunities from municipal meetings\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const rfp of municipalRfps) {
    const fields = rfp.custom_fields || {};

    console.log(`📋 ${rfp.title}`);
    console.log(`🏢 ${rfp.organizations?.name} (${fields.region || 'N/A'})`);
    console.log(`📅 Meeting Date: ${fields.meeting_date || 'Not specified'}`);
    console.log(`🏛️  Committee: ${fields.committee_name || 'Not specified'}`);
    console.log(`📝 Agenda Item: ${fields.agenda_item || 'Not specified'}`);
    console.log(`🤖 AI Confidence: ${fields.ai_confidence || 'N/A'}%`);
    console.log(`🔗 Meeting Link: ${fields.meeting_url || fields.calendar_url || 'N/A'}`);

    console.log(`\n📄 Description:`);
    console.log(`   ${rfp.description}`);

    if (fields.excerpt) {
      console.log(`\n💬 Excerpt from Minutes:`);
      const excerpt = fields.excerpt.substring(0, 300);
      console.log(`   "${excerpt}${fields.excerpt.length > 300 ? '...' : ''}"`);
    }

    if (rfp.estimated_value) {
      console.log(`\n💰 Estimated Value: $${rfp.estimated_value.toLocaleString()} ${rfp.currency || 'CAD'}`);
    }

    if (rfp.due_date) {
      console.log(`⏰ Due Date: ${rfp.due_date}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total opportunities: ${municipalRfps.length}`);

  // Group by province
  const byProvince = municipalRfps.reduce((acc: any, rfp: any) => {
    const province = rfp.custom_fields?.region || 'Unknown';
    acc[province] = (acc[province] || 0) + 1;
    return acc;
  }, {});

  console.log(`\n   By Province:`);
  Object.entries(byProvince).forEach(([province, count]) => {
    console.log(`   - ${province}: ${count}`);
  });

  console.log(`\n🔍 HOW TO FILTER IN CRM:`);
  console.log(`   1. Go to: http://localhost:3000/projects/${PROJECT_ID.substring(0, 8)}.../rfps`);
  console.log(`   2. Use custom field filter: source = "municipal_minutes"`);
  console.log(`   3. Filter by region: custom_fields.region = "Nova Scotia" (or any province)`);
  console.log(`   4. Filter by committee: custom_fields.committee_name = "Regional Council"`);
  console.log(`   5. Filter by confidence: custom_fields.ai_confidence >= 70\n`);
}

showResearch();
