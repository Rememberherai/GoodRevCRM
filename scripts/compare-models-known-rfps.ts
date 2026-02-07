#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
import { fetchMeetingContent } from '../lib/municipal-scanner/meeting-finder';
import { getOpenRouterClient } from '../lib/openrouter/client';

dotenv.config({ path: '.env.local' });

// Known documents that found RFPs in previous test runs
const knownRfpDocuments = [
  {
    municipality: 'Banff, Alberta',
    url: 'https://banff.ca/147/Environment',
    type: 'html' as const,
    notes: 'Sonnet found 1 RFP (Document [1])',
  },
  {
    municipality: 'Banff, Alberta',
    url: 'https://banff.ca/290/Environmental-Master-Plan',
    type: 'html' as const,
    notes: 'Sonnet found 1 RFP (Document [4])',
  },
  {
    municipality: 'Banff, Alberta',
    url: 'https://banff.ca/1295/Zero-Waste-Action-Plan',
    type: 'html' as const,
    notes: 'Sonnet found 1 RFP (Document [5])',
  },
  {
    municipality: 'Banff, Alberta',
    url: 'https://banff.ca/FormCenter/Operations-7/Commercial-WasteBin-QuantitySize-Change-148',
    type: 'html' as const,
    notes: 'Sonnet found 1 RFP, Grok found 2 RFPs (Document [9])',
  },
  {
    municipality: 'Banff, Alberta',
    url: 'https://banff.ca/FormCenter/Operations-7/Commercial-WasteChange-to-Weekly-Pickup-150',
    type: 'html' as const,
    notes: 'Grok found 2 RFPs (Document [10])',
  },
  {
    municipality: 'Banff, Alberta',
    url: 'https://banff.ca/409/Non-Residential-Waste-Utility-Fees',
    type: 'html' as const,
    notes: 'Sonnet found 1 RFP (Document [11])',
  },
  {
    municipality: 'Banff, Alberta',
    url: 'https://banff.ca/FormCenter/Operations-7/Commercial-WasteAdditional-Service-149',
    type: 'html' as const,
    notes: 'Grok found 1 RFP (Document [12])',
  },
  {
    municipality: 'Banff, Alberta',
    url: 'https://banff.ca/1173/Zero-Waste-Requirements-for-Building-Permits',
    type: 'html' as const,
    notes: 'Sonnet found 1 RFP (Document [13])',
  },
  {
    municipality: 'Banff, Alberta',
    url: 'https://banff.ca/154/Zero-Waste-Banff',
    type: 'html' as const,
    notes: 'Sonnet found 1 RFP (Document [14])',
  },
  {
    municipality: 'Banff, Alberta',
    url: 'https://banff.ca/992/Wastewater-Treatment-Plant-Upgrades',
    type: 'html' as const,
    notes: 'Sonnet found 1 RFP (Document [16])',
  },
];

async function extractWithModel(text: string, municipality: string, model: string) {
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

Municipality: ${municipality}

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

async function main() {
  console.log(`\n🔬 AI Model Comparison: Testing on Known RFP Documents`);
  console.log('='.repeat(70));
  console.log(`Models: Claude Sonnet 4.5, Grok 4.1 Fast, GPT-4o Mini, DeepSeek Chat V3.1`);
  console.log(`Testing ${knownRfpDocuments.length} documents that previously found RFPs\n`);

  const models = [
    { name: 'Sonnet 4.5', id: 'anthropic/claude-3.5-sonnet', cost: '$3/$15' },
    { name: 'Grok 4.1 Fast', id: 'x-ai/grok-4.1-fast', cost: '$0.20/$0.50' },
    { name: 'GPT-4o Mini', id: 'openai/gpt-4o-mini', cost: '$0.15/$0.60' },
    { name: 'DeepSeek V3.1', id: 'deepseek/deepseek-chat-v3.1', cost: '$0.27/$1.10' },
  ];

  const results: any[] = [];

  for (let i = 0; i < knownRfpDocuments.length; i++) {
    const doc = knownRfpDocuments[i];
    console.log(`\n[${ i + 1}/${knownRfpDocuments.length}] ${doc.municipality}`);
    console.log(`  📄 ${doc.url}`);
    console.log(`  📝 ${doc.notes}`);

    try {
      // Fetch content
      const content = await fetchMeetingContent({ url: doc.url, type: doc.type });
      if (!content || content.length < 100) {
        console.log(`  ⚠️  Skipping - too little content`);
        continue;
      }

      console.log(`  📊 ${content.length.toLocaleString()} characters extracted\n`);

      const modelResults: any = {
        municipality: doc.municipality,
        url: doc.url,
        characterCount: content.length,
        notes: doc.notes,
      };

      // Test each model
      for (const model of models) {
        console.log(`  🤖 Testing ${model.name}...`);
        const rfps = await extractWithModel(content, doc.municipality, model.id);
        modelResults[model.id] = rfps;

        if (rfps.length > 0) {
          console.log(`     ✅ Found ${rfps.length} RFPs`);
          rfps.forEach((rfp: any) => {
            console.log(`        - "${rfp.title}" (confidence: ${rfp.confidence})`);
          });
        } else {
          console.log(`     ⚪ No RFPs found`);
        }

        // Delay between model calls
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      results.push(modelResults);
      console.log('');
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
    }

    // Delay between documents
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Print comparison summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 COMPARISON SUMMARY');
  console.log('='.repeat(70));

  const modelTotals = models.map(model => ({
    name: model.name,
    id: model.id,
    cost: model.cost,
    total: results.reduce((sum, r) => sum + (r[model.id]?.length || 0), 0),
  }));

  console.log(`\nTotal RFPs found by each model:\n`);
  modelTotals.forEach(m => {
    console.log(`  ${m.name.padEnd(20)} ${m.total} RFPs  (${m.cost} per 1M tokens)`);
  });

  const winner = modelTotals.reduce((max, m) => m.total > max.total ? m : max);
  console.log(`\n🏆 Most RFPs found: ${winner.name} (${winner.total} total)`);

  // Show detailed breakdown
  console.log('\n\n' + '='.repeat(70));
  console.log('📋 DETAILED RESULTS BY DOCUMENT');
  console.log('='.repeat(70));

  for (const result of results) {
    console.log(`\n${result.municipality}`);
    console.log(`URL: ${result.url}`);
    console.log(`Size: ${result.characterCount.toLocaleString()} chars`);
    console.log(`Previous finding: ${result.notes}\n`);

    models.forEach(model => {
      const rfps = result[model.id] || [];
      console.log(`  ${model.name}: ${rfps.length} RFPs`);
      if (rfps.length > 0) {
        rfps.forEach((rfp: any, idx: number) => {
          console.log(`    ${idx + 1}. "${rfp.title}"`);
          console.log(`       Confidence: ${rfp.confidence}`);
          console.log(`       Type: ${rfp.opportunity_type}`);
          console.log(`       Description: ${rfp.description?.substring(0, 120)}...`);
        });
      }
    });
  }

  // Save detailed results
  const outputFile = `model-comparison-known-rfps-${new Date().toISOString().split('T')[0]}.json`;
  const fs = await import('fs/promises');
  await fs.writeFile(
    outputFile,
    JSON.stringify({
      testedAt: new Date().toISOString(),
      documentsCount: results.length,
      models,
      modelTotals,
      results,
    }, null, 2)
  );

  console.log(`\n\n💾 Detailed results saved to: ${outputFile}`);
}

main().catch(console.error);
