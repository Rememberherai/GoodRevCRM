#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRFPs() {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('rfps')
    .select('title, description, estimated_value, currency, custom_fields, created_at')
    .eq('custom_fields->>source', 'municipal_minutes')
    .gte('created_at', sixHoursAgo)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== Recently Created Municipal RFPs (Last 6 Hours) ===\n');
  console.log(`Found ${data?.length || 0} RFPs\n`);

  if (!data || data.length === 0) {
    console.log('No RFPs found in the last 6 hours.');
    return;
  }

  data?.forEach((rfp, idx) => {
    console.log(`\n[RFP ${idx + 1}] ${rfp.title}`);
    console.log(`Created: ${new Date(rfp.created_at).toLocaleString()}`);
    console.log(`Value: ${rfp.estimated_value ? '$' + rfp.estimated_value.toLocaleString() + ' ' + rfp.currency : 'Not specified'}`);
    console.log(`\nDescription (${rfp.description.length} chars):`);
    console.log(rfp.description);

    const excerpt = rfp.custom_fields?.excerpt;
    if (excerpt) {
      console.log(`\nExcerpt from Minutes (${excerpt.length} chars):`);
      console.log(excerpt.substring(0, 500) + (excerpt.length > 500 ? '...\n[TRUNCATED]' : ''));
    }

    const meetingUrl = rfp.custom_fields?.meeting_url;
    const meetingDate = rfp.custom_fields?.meeting_date;
    const agendaItem = rfp.custom_fields?.agenda_item;

    if (meetingUrl) console.log(`\nMeeting URL: ${meetingUrl}`);
    if (meetingDate) console.log(`Meeting Date: ${meetingDate}`);
    if (agendaItem) console.log(`Agenda Item: ${agendaItem}`);

    console.log('\n' + '='.repeat(100));
  });
}

checkRFPs().catch(console.error);
