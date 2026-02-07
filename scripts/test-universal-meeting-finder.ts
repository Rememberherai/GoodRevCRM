#!/usr/bin/env tsx
import { findMeetingDocuments } from '../lib/municipal-scanner/meeting-finder';

async function testUniversalFinder() {
  console.log('\n🧪 Testing Universal Meeting Finder\n');
  console.log('Testing municipalities that previously failed...\n');

  const testCases = [
    {
      name: 'Town of Bashaw',
      url: 'https://www.townofbashaw.com/municipal/council/council-information',
      system: 'download_file/view pattern',
    },
    {
      name: 'RM of Hanover',
      url: 'https://www.hanovermb.ca/p/council-meetings',
      system: 'AllNet Meetings (agendaCategories)',
    },
    {
      name: 'RM of Macdonald',
      url: 'https://www.macdonald.ca/p/meeting-agendas-and-minutes',
      system: 'AllNet Meetings (agendaCategories)',
    },
    {
      name: 'RM of Ritchot',
      url: 'https://www.ritchot.com/p/meeting-minutes-and-agendas',
      system: 'AllNet Meetings (agendaCategories)',
    },
    {
      name: 'RM of Rockwood',
      url: 'https://www.rockwood.ca/p/minutes-and-agendas',
      system: 'AllNet Meetings (agendaCategories)',
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n📍 ${testCase.name}`);
    console.log(`   System: ${testCase.system}`);
    console.log(`   URL: ${testCase.url}`);

    try {
      const meetings = await findMeetingDocuments(testCase.url);

      if (meetings.length > 0) {
        console.log(`   ✅ SUCCESS - Found ${meetings.length} meetings`);
        console.log(`   Sample meetings:`);
        meetings.slice(0, 3).forEach((m, idx) => {
          console.log(`      ${idx + 1}. ${m.title || '(no title)'}`);
          console.log(`         ${m.url.substring(0, 80)}${m.url.length > 80 ? '...' : ''}`);
        });
      } else {
        console.log(`   ❌ FAILED - No meetings found`);
      }
    } catch (error: any) {
      console.log(`   ❌ ERROR - ${error.message}`);
    }
  }

  console.log('\n\n📊 Test Complete!\n');
}

testUniversalFinder().catch(console.error);
