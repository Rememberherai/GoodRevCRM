import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROJECT_ID = '92352069-9031-4f9c-a89b-e09dc51d2d16';

async function listMunicipalRfps() {
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

  // Filter for municipal RFPs
  const municipalRfps = data.filter(rfp =>
    rfp.custom_fields?.source === 'municipal_minutes'
  );

  console.log('🇨🇦 Municipal RFPs in Database\n');
  console.log(`Total: ${municipalRfps.length}\n`);

  for (const rfp of municipalRfps) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 ${rfp.title}`);
    console.log(`🏢 Organization: ${rfp.organizations?.name}`);
    console.log(`📍 Location: ${rfp.organizations?.address_city}, ${rfp.organizations?.address_state}`);
    console.log(`📝 Status: ${rfp.status}`);

    if (rfp.due_date) {
      console.log(`📅 Due Date: ${rfp.due_date}`);
    }

    if (rfp.estimated_value) {
      console.log(`💰 Estimated Value: $${rfp.estimated_value.toLocaleString()} ${rfp.currency || 'CAD'}`);
    }

    if (rfp.submission_method) {
      console.log(`📬 Submission: ${rfp.submission_method}`);
    }

    if (rfp.submission_email) {
      console.log(`📧 Email: ${rfp.submission_email}`);
    }

    if (rfp.custom_fields?.ai_confidence) {
      console.log(`🤖 AI Confidence: ${rfp.custom_fields.ai_confidence}%`);
    }

    if (rfp.custom_fields?.minutes_url) {
      console.log(`🔗 Source: ${rfp.custom_fields.minutes_url}`);
    }

    console.log(`\n📄 Description:`);
    console.log(`${rfp.description}\n`);
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n✅ Found ${municipalRfps.length} municipal RFPs in the database`);
  console.log(`\n🔗 View in CRM: http://localhost:3000/projects/${PROJECT_ID.substring(0, 8)}.../rfps`);
  console.log(`📋 Filter by: custom_fields.source = "municipal_minutes"\n`);
}

listMunicipalRfps();
