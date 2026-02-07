#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { extractRfpsFromMinutes } from '../lib/municipal-scanner/ai-extractor';
import { findMeetingDocuments, fetchMeetingContent } from '../lib/municipal-scanner/meeting-finder';
import { SCANNER_CONFIG } from '../lib/municipal-scanner/config';
import type { Municipality } from '../lib/municipal-scanner/types';
import { getOpenRouterClient } from '../lib/openrouter/client';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ModelComparison {
  municipality: string;
  documentUrl: string;
  documentType: string;
  characterCount: number;
  sonnetRfps: any[];
  grokRfps: any[];
  gpt4oMiniRfps: any[];
  deepseekRfps: any[];
  differenceSummary: string;
}

async function extractWithModel(text: string, municipality: string, province: string, model: string) {
  const prompt = `You are analyzing municipal meeting minutes to identify procurement opportunities related to:
- Waste management (solid waste, recycling, composting, landfills)
- Water treatment (drinking water, water infrastructure, water quality)
- Wastewater treatment (sewage, WWTP, collection systems, stormwater)

IMPORTANT: Only extract ACTUAL procurement opportunities (RFPs, tenders, bids). DO NOT extract:
- Service descriptions or fee schedules
- General information about programs
- Historical completed projects
- Forms or applications

For each RFP, Request for Proposal, bid opportunity, or tender mentioned, extract:
1. Title/Project Name
2. Description of scope of work
3. Due date / submission deadline (if mentioned)
4. Estimated value or budget (if mentioned)
5. Submission method (email, portal, physical)
6. Any contact information

Return ONLY opportunities that are:
- Active or upcoming (not historical/completed)
- Related to waste/water/wastewater
- Actually procurement opportunities (not just discussion or information)

Return as JSON with this exact schema:
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
      "confidence": number,
      "opportunity_type": "formal_rfp" | "informal_opportunity" | "future_opportunity"
    }
  ]
}

If no RFPs found, return {"rfps": []}.

Municipality: ${municipality}, ${province}

Meeting Minutes Text:
${text.slice(0, 100000)}`;

  try {
    const openrouter = getOpenRouterClient();
    const response = await openrouter.chat(
      [{ role: 'user', content: prompt }],
      {
        model,
        temperature: 0.3,
        responseFormat: 'json_object',
        maxTokens: 4096,
      }
    );

    let content = response.choices[0]?.message?.content || '{}';

    // Some models may wrap JSON in markdown code blocks or add explanatory text
    // Try to extract just the JSON part
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }

    const parsed = JSON.parse(content);
    return parsed.rfps || [];
  } catch (error: any) {
    console.error(`    ❌ ${model} error: ${error.message}`);
    return [];
  }
}

function compareLists(sonnetRfps: any[], grokRfps: any[], gpt4oMiniRfps: any[], deepseekRfps: any[]): string {
  const counts = [sonnetRfps.length, grokRfps.length, gpt4oMiniRfps.length, deepseekRfps.length];
  const allZero = counts.every(c => c === 0);
  const allSame = counts.every(c => c === counts[0]);

  if (allZero) {
    return '✓ All 4 models found 0 RFPs';
  }
  if (allSame) {
    return `⚠️  All 4 models found ${counts[0]} RFPs (same count)`;
  }
  return `❌ DIFFERENT: Sonnet=${sonnetRfps.length}, Grok=${grokRfps.length}, GPT-4o-mini=${gpt4oMiniRfps.length}, DeepSeek=${deepseekRfps.length}`;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--limit')
    ? parseInt(args[args.indexOf('--limit') + 1], 10)
    : 3;

  console.log(`\n🔬 AI Model Comparison: 4 Models`);
  console.log('='.repeat(70));
  console.log(`Models: Claude Sonnet 4.5, Grok 4.1 Fast, GPT-4o Mini, DeepSeek Chat V3.1`);
  console.log(`Testing on ${limit} municipalities\n`);

  // Prioritize municipalities we know have good meeting content
  // Based on previous test runs, these municipalities had RFP hits
  const priorityMunicipalities = [
    'Banff',
    'Calgary',
    'Edmonton',
    'Regina',
    'Saskatoon',
    'Winnipeg',
    'Halifax',
    'Charlottetown',
  ];

  // Get municipalities - prioritize known good ones
  let query = supabase
    .from('municipalities')
    .select('*')
    .not('minutes_url', 'is', null)
    .eq('scan_status', 'pending');

  // First try to get priority municipalities
  const { data: priorityData } = await query.in('name', priorityMunicipalities).limit(limit);

  let municipalities = priorityData || [];

  // If we don't have enough, get more
  if (municipalities.length < limit) {
    const { data: additionalData } = await supabase
      .from('municipalities')
      .select('*')
      .not('minutes_url', 'is', null)
      .eq('scan_status', 'pending')
      .not('name', 'in', `(${priorityMunicipalities.map(n => `'${n}'`).join(',')})`)
      .order('province')
      .order('name')
      .limit(limit - municipalities.length);

    if (additionalData) {
      municipalities = [...municipalities, ...additionalData];
    }
  }

  if (!municipalities || municipalities.length === 0) {
    console.log('No municipalities found to test.');
    return;
  }

  const comparisons: ModelComparison[] = [];

  for (let i = 0; i < municipalities.length; i++) {
    const municipality = municipalities[i];
    console.log(`\n[${ i + 1}/${municipalities.length}] ${municipality.name}, ${municipality.province}`);
    console.log(`  📄 ${municipality.minutes_url}`);

    try {
      // Find meeting documents
      const meetingDocs = await findMeetingDocuments(
        municipality.minutes_url,
        SCANNER_CONFIG.dateRangeMonths
      );

      if (meetingDocs.length === 0) {
        console.log(`  ⚠️  No meeting documents found`);
        continue;
      }

      console.log(`  📎 Found ${meetingDocs.length} meeting documents`);

      // Test first 10 documents from each municipality (more likely to find RFPs)
      const docsToTest = meetingDocs.slice(0, 10);

      for (let j = 0; j < docsToTest.length; j++) {
        const doc = docsToTest[j];
        console.log(`\n  📄 Document ${j + 1}/${docsToTest.length}: ${doc.url.substring(0, 70)}...`);

        // Fetch content
        const content = await fetchMeetingContent(doc);
        if (!content || content.length < 100) {
          console.log(`    ⚠️  Skipping - too little content`);
          continue;
        }

        console.log(`    📝 ${content.length.toLocaleString()} characters extracted`);

        // Test with all 4 models
        console.log(`    🤖 Testing Sonnet 4.5...`);
        const sonnetRfps = await extractWithModel(
          content,
          municipality.name,
          municipality.province,
          'anthropic/claude-3.5-sonnet'
        );

        console.log(`    🤖 Testing Grok 4.1 Fast...`);
        const grokRfps = await extractWithModel(
          content,
          municipality.name,
          municipality.province,
          'x-ai/grok-4.1-fast'
        );

        console.log(`    🤖 Testing GPT-4o Mini...`);
        const gpt4oMiniRfps = await extractWithModel(
          content,
          municipality.name,
          municipality.province,
          'openai/gpt-4o-mini'
        );

        console.log(`    🤖 Testing DeepSeek Chat V3.1...`);
        const deepseekRfps = await extractWithModel(
          content,
          municipality.name,
          municipality.province,
          'deepseek/deepseek-chat-v3.1'
        );

        const comparison: ModelComparison = {
          municipality: `${municipality.name}, ${municipality.province}`,
          documentUrl: doc.url,
          documentType: doc.type,
          characterCount: content.length,
          sonnetRfps,
          grokRfps,
          gpt4oMiniRfps,
          deepseekRfps,
          differenceSummary: compareLists(sonnetRfps, grokRfps, gpt4oMiniRfps, deepseekRfps),
        };

        comparisons.push(comparison);

        console.log(`    📊 ${comparison.differenceSummary}`);
        if (sonnetRfps.length > 0) {
          console.log(`       Sonnet: ${sonnetRfps.map(r => `"${r.title}"`).join(', ')}`);
        }
        if (grokRfps.length > 0) {
          console.log(`       Grok: ${grokRfps.map(r => `"${r.title}"`).join(', ')}`);
        }
        if (gpt4oMiniRfps.length > 0) {
          console.log(`       GPT-4o-mini: ${gpt4oMiniRfps.map(r => `"${r.title}"`).join(', ')}`);
        }
        if (deepseekRfps.length > 0) {
          console.log(`       DeepSeek: ${deepseekRfps.map(r => `"${r.title}"`).join(', ')}`);
        }

        // Delay between documents
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
    }

    // Delay between municipalities
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Print summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 COMPARISON SUMMARY');
  console.log('='.repeat(70));

  const totalDocs = comparisons.length;
  const allZero = comparisons.filter(c =>
    c.sonnetRfps.length === 0 &&
    c.grokRfps.length === 0 &&
    c.gpt4oMiniRfps.length === 0 &&
    c.deepseekRfps.length === 0
  ).length;
  const allSame = comparisons.filter(c => {
    const counts = [c.sonnetRfps.length, c.grokRfps.length, c.gpt4oMiniRfps.length, c.deepseekRfps.length];
    return counts.every(count => count === counts[0]) && counts[0] > 0;
  }).length;
  const anyDifferent = comparisons.filter(c => {
    const counts = [c.sonnetRfps.length, c.grokRfps.length, c.gpt4oMiniRfps.length, c.deepseekRfps.length];
    return !counts.every(count => count === counts[0]);
  }).length;

  console.log(`\nTotal documents tested: ${totalDocs}`);
  console.log(`All 4 models found 0 RFPs: ${allZero} (${((allZero / totalDocs) * 100).toFixed(1)}%)`);
  console.log(`All 4 models agree (non-zero): ${allSame} (${((allSame / totalDocs) * 100).toFixed(1)}%)`);
  console.log(`Models disagree: ${anyDifferent} (${((anyDifferent / totalDocs) * 100).toFixed(1)}%)`);

  const totalSonnet = comparisons.reduce((sum, c) => sum + c.sonnetRfps.length, 0);
  const totalGrok = comparisons.reduce((sum, c) => sum + c.grokRfps.length, 0);
  const totalGpt4oMini = comparisons.reduce((sum, c) => sum + c.gpt4oMiniRfps.length, 0);
  const totalDeepSeek = comparisons.reduce((sum, c) => sum + c.deepseekRfps.length, 0);

  console.log(`\nTotal RFPs extracted:`);
  console.log(`  Sonnet 4.5:        ${totalSonnet} RFPs`);
  console.log(`  Grok 4.1 Fast:     ${totalGrok} RFPs`);
  console.log(`  GPT-4o Mini:       ${totalGpt4oMini} RFPs`);
  console.log(`  DeepSeek Chat V3:  ${totalDeepSeek} RFPs`);

  const winner = Math.max(totalSonnet, totalGrok, totalGpt4oMini, totalDeepSeek);
  const winnerName = winner === totalSonnet ? 'Sonnet' :
                     winner === totalGrok ? 'Grok' :
                     winner === totalGpt4oMini ? 'GPT-4o-mini' : 'DeepSeek';
  console.log(`\n🏆 Most RFPs found: ${winnerName} (${winner} total)`);

  // Show documents where they disagreed
  const disagreements = comparisons.filter(c => {
    const counts = [c.sonnetRfps.length, c.grokRfps.length, c.gpt4oMiniRfps.length, c.deepseekRfps.length];
    return !counts.every(count => count === counts[0]);
  });
  if (disagreements.length > 0) {
    console.log('\n\n' + '='.repeat(70));
    console.log('⚠️  DISAGREEMENTS (Different RFP Counts)');
    console.log('='.repeat(70));

    for (const comp of disagreements) {
      console.log(`\n${comp.municipality}`);
      console.log(`URL: ${comp.documentUrl}`);
      console.log(`Type: ${comp.documentType} | Size: ${comp.characterCount.toLocaleString()} chars`);
      console.log(`Counts: Sonnet=${comp.sonnetRfps.length}, Grok=${comp.grokRfps.length}, GPT-4o-mini=${comp.gpt4oMiniRfps.length}, DeepSeek=${comp.deepseekRfps.length}`);

      if (comp.sonnetRfps.length > 0) {
        console.log(`\n  Sonnet RFPs:`);
        comp.sonnetRfps.forEach((rfp, idx) => {
          console.log(`    ${idx + 1}. "${rfp.title}" (confidence: ${rfp.confidence})`);
          console.log(`       ${rfp.description?.substring(0, 100)}...`);
        });
      }

      if (comp.grokRfps.length > 0) {
        console.log(`\n  Grok RFPs:`);
        comp.grokRfps.forEach((rfp, idx) => {
          console.log(`    ${idx + 1}. "${rfp.title}" (confidence: ${rfp.confidence})`);
          console.log(`       ${rfp.description?.substring(0, 100)}...`);
        });
      }

      if (comp.gpt4oMiniRfps.length > 0) {
        console.log(`\n  GPT-4o-mini RFPs:`);
        comp.gpt4oMiniRfps.forEach((rfp, idx) => {
          console.log(`    ${idx + 1}. "${rfp.title}" (confidence: ${rfp.confidence})`);
          console.log(`       ${rfp.description?.substring(0, 100)}...`);
        });
      }

      if (comp.deepseekRfps.length > 0) {
        console.log(`\n  DeepSeek RFPs:`);
        comp.deepseekRfps.forEach((rfp, idx) => {
          console.log(`    ${idx + 1}. "${rfp.title}" (confidence: ${rfp.confidence})`);
          console.log(`       ${rfp.description?.substring(0, 100)}...`);
        });
      }
    }
  }

  // Save detailed results to JSON
  const outputFile = `model-comparison-${new Date().toISOString().split('T')[0]}.json`;
  const fs = await import('fs/promises');
  await fs.writeFile(
    outputFile,
    JSON.stringify({
      testedAt: new Date().toISOString(),
      municipalitiesCount: municipalities.length,
      documentsCount: totalDocs,
      summary: {
        totalSonnetRfps: totalSonnet,
        totalGrokRfps: totalGrok,
        totalGpt4oMiniRfps: totalGpt4oMini,
        totalDeepSeekRfps: totalDeepSeek,
        allZeroCount: allZero,
        allAgreeNonZero: allSame,
        anyDifferentCount: anyDifferent,
      },
      comparisons,
    }, null, 2)
  );

  console.log(`\n\n💾 Detailed results saved to: ${outputFile}`);
}

main().catch(console.error);
