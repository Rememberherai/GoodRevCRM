import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  console.log('Testing OpenRouter API...');
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 20)}...` : 'NOT FOUND');

  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not found');
    return;
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'GoodRev CRM',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: 'Say "test successful" if you can read this.' }],
      max_tokens: 20
    }),
  });

  console.log('Response status:', response.status);
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));

  if (response.ok && data.choices?.[0]?.message?.content) {
    console.log('\n✅ OpenRouter API is working!');
    console.log('AI Response:', data.choices[0].message.content);
  } else {
    console.log('\n❌ OpenRouter API failed');
  }
}

testOpenRouter();
