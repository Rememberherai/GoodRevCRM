/**
 * Sign-in sheet OCR scanning — parse handwritten names from uploaded images.
 *
 * Uses OpenRouter for OCR, then fuzzy matches against project people.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { scorePersonMatch } from '@/lib/deduplication/detector';
import { getProjectSecret } from '@/lib/secrets';

// ============================================================
// OCR via OpenRouter
// ============================================================

interface ParsedName {
  raw_text: string;
  matched_person_id: string | null;
  match_confidence: number;
  suggested_name: string;
  match_status: 'matched' | 'possible' | 'unmatched';
}

/**
 * Parse names from a sign-in sheet image using Claude Vision via OpenRouter.
 */
export async function parseSignInSheet(
  projectId: string,
  imageBase64: string,
  mimeType: string
): Promise<string[]> {
  const apiKey = await getProjectSecret(projectId, 'openrouter_api_key');
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured for this project');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'GoodRev CRM',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
            {
              type: 'text',
              text: 'Extract all handwritten names from this sign-in sheet. Return ONLY a JSON array of strings, one per name. Example: ["John Smith", "Jane Doe"]. If you cannot read a name clearly, include your best guess. Do not include any other text.',
            },
          ],
        },
      ],
      max_tokens: 2000,
    }),
  });

  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }> | null;
      };
    }>;
  };
  const rawContent = data.choices?.[0]?.message?.content;
  const content = typeof rawContent === 'string'
    ? rawContent
    : Array.isArray(rawContent)
      ? rawContent.map((item) => item.text ?? '').join('\n')
      : '[]';

  // Extract JSON array from response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const names = JSON.parse(jsonMatch[0]) as string[];
    return names.filter((n: unknown) => typeof n === 'string' && n.trim().length > 0);
  } catch {
    console.error('Failed to parse OCR response:', content);
    return [];
  }
}

// ============================================================
// Fuzzy match parsed names against project people
// ============================================================

/**
 * Match parsed names against all people in a project using fuzzy matching.
 */
export async function matchParsedNames(
  names: string[],
  projectId: string
): Promise<ParsedName[]> {
  const supabase = createServiceClient();

  // Load all people in the project
  const { data: people } = await supabase
    .from('people')
    .select('id, first_name, last_name, email')
    .eq('project_id', projectId)
    .is('deleted_at', null);

  if (!people || people.length === 0) {
    return names.map((name) => ({
      raw_text: name,
      matched_person_id: null,
      match_confidence: 0,
      suggested_name: name,
      match_status: 'unmatched' as const,
    }));
  }

  const results: ParsedName[] = [];

  for (const rawName of names) {
    let bestMatch: { personId: string; confidence: number; name: string } | null = null;

    for (const person of people) {
      const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ');
      if (!fullName) continue;

      const nameParts = rawName.trim().split(/\s+/);
      const result = scorePersonMatch(
        { first_name: nameParts[0] || null, last_name: nameParts.slice(1).join(' ') || null, email: null },
        { first_name: person.first_name, last_name: person.last_name, email: person.email }
      );

      if (!bestMatch || result.score > bestMatch.confidence) {
        bestMatch = { personId: person.id, confidence: result.score, name: fullName };
      }
    }

    if (bestMatch && bestMatch.confidence > 0.85) {
      results.push({
        raw_text: rawName,
        matched_person_id: bestMatch.personId,
        match_confidence: bestMatch.confidence,
        suggested_name: bestMatch.name,
        match_status: 'matched',
      });
    } else if (bestMatch && bestMatch.confidence > 0.65) {
      results.push({
        raw_text: rawName,
        matched_person_id: bestMatch.personId,
        match_confidence: bestMatch.confidence,
        suggested_name: bestMatch.name,
        match_status: 'possible',
      });
    } else {
      results.push({
        raw_text: rawName,
        matched_person_id: null,
        match_confidence: bestMatch?.confidence ?? 0,
        suggested_name: rawName,
        match_status: 'unmatched',
      });
    }
  }

  return results;
}
