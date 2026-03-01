#!/usr/bin/env tsx
import { getOpenRouterClient } from '../lib/openrouter/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testGrokWebSearch() {
  console.log('\n🧪 Testing Grok Web Search Plugin');
  console.log('====================================\n');

  const testCities = [
    { name: 'Phoenix', state: 'Arizona' },
    { name: 'San Antonio', state: 'Texas' },
    { name: 'Austin', state: 'Texas' },
  ];

  for (const city of testCities) {
    console.log(`\n🔍 Testing: ${city.name}, ${city.state}`);
    console.log('-----------------------------------');

    const prompt = `Find the official meeting minutes or agendas page URL for ${city.name}, ${city.state}.

Search the web for: "${city.name} ${city.state} city council meeting minutes agendas"

IMPORTANT: Return the SPECIFIC page URL where meeting minutes/agendas are listed, NOT just the homepage.

Return ONLY the direct URL, or "NOT_FOUND" if you cannot find it.`;

    try {
      const openrouter = getOpenRouterClient();
      const response = await openrouter.chat(
        [{ role: 'user', content: prompt }],
        {
          model: 'x-ai/grok-4.1-fast',
          temperature: 0.1,
          maxTokens: 500,
          provider: {
            allow_fallbacks: false,
            plugins: ['web-search'],
          },
        }
      );

      const content = response.choices[0]?.message?.content?.trim() || '';
      console.log(`\nFull AI Response:\n${content}\n`);

      const urlMatch = content.match(/https?:\/\/[^\s<>"]+/);
      if (urlMatch) {
        console.log(`✅ Extracted URL: ${urlMatch[0]}`);
      } else {
        console.log(`❌ No URL found in response`);
      }
    } catch (error) {
      console.error(`❌ Error:`, error);
    }

    // Delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n====================================\n');
}

testGrokWebSearch().catch(console.error);
