#!/usr/bin/env tsx
import { findMeetingDocuments } from '../lib/municipal-scanner/meeting-finder';

async function backtestMunicipalities() {
  console.log('\n🧪 Backtesting Universal Meeting Finder on Previously Failed Municipalities\n');

  const testCases = [
    {
      name: 'Rural Municipality of Hanover',
      url: 'https://www.hanovermb.ca/p/council-meetings',
      expectedSystem: 'AllNet Meetings iframe',
      expectedMinMeetings: 10,
    },
    {
      name: 'Rural Municipality of Ritchot',
      url: 'https://www.ritchot.com/p/meeting-minutes-and-agendas',
      expectedSystem: 'AllNet Meetings iframe',
      expectedMinMeetings: 20,
    },
    {
      name: 'Rural Municipality of Rockwood',
      url: 'https://www.rockwood.ca/p/minutes-and-agendas',
      expectedSystem: 'AllNet Meetings iframe',
      expectedMinMeetings: 15,
    },
    {
      name: 'City of Winnipeg',
      url: 'https://clkapps.winnipeg.ca/dmis/latestagendas.asp',
      expectedSystem: 'DMIS (ShowDoc.asp)',
      expectedMinMeetings: 5,
    },
    {
      name: 'City of Portage la Prairie',
      url: 'https://www.city-plap.com/council-administration/council',
      expectedSystem: 'Unknown',
      expectedMinMeetings: 0,
    },
    {
      name: 'City of Selkirk',
      url: 'https://www.myselkirk.ca/city-government/city-council/council-and-committee-minutes',
      expectedSystem: 'Unknown',
      expectedMinMeetings: 0,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`\n📍 ${testCase.name}`);
    console.log(`   Expected system: ${testCase.expectedSystem}`);
    console.log(`   Expected min meetings: ${testCase.expectedMinMeetings}`);

    try {
      const meetings = await findMeetingDocuments(testCase.url);

      const success = meetings.length >= testCase.expectedMinMeetings;

      if (success) {
        console.log(`   ✅ PASS - Found ${meetings.length} meetings (expected >= ${testCase.expectedMinMeetings})`);
        passed++;

        if (meetings.length > 0) {
          console.log(`   Sample meetings:`);
          meetings.slice(0, 3).forEach((m, idx) => {
            console.log(`      ${idx + 1}. ${m.title || '(no title)'}`);
            console.log(`         Type: ${m.type}`);
            console.log(`         URL: ${m.url.substring(0, 70)}...`);
          });
        }
      } else {
        console.log(`   ❌ FAIL - Found ${meetings.length} meetings (expected >= ${testCase.expectedMinMeetings})`);
        failed++;
      }
    } catch (error: any) {
      console.log(`   ❌ FAIL - Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n\n📊 Backtest Results:\n');
  console.log(`   ✅ Passed: ${passed}/${testCases.length}`);
  console.log(`   ❌ Failed: ${failed}/${testCases.length}`);
  console.log(`   Success rate: ${Math.round((passed / testCases.length) * 100)}%\n`);
}

backtestMunicipalities().catch(console.error);
