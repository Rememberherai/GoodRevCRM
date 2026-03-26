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

export interface ParsedName {
  raw_text: string;
  raw_email: string | null;
  raw_phone: string | null;
  matched_person_id: string | null;
  match_confidence: number;
  suggested_name: string;
  match_status: 'matched' | 'possible' | 'unmatched';
  /** true when the scanned email is not already on the matched person */
  new_email: boolean;
  /** true when the scanned phone is not already on the matched person */
  new_phone: boolean;
}

interface ScannedEntry {
  name: string;
  email?: string | null;
  phone?: string | null;
}

/**
 * Parse names (and optionally emails/phones) from a sign-in sheet image using Vision via OpenRouter.
 */
export async function parseSignInSheet(
  projectId: string,
  imageBase64: string,
  mimeType: string
): Promise<ScannedEntry[]> {
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
              text: 'Extract all entries from this sign-in sheet. For each person, extract their name, and if visible, their email address and phone number. Return ONLY a JSON array of objects. Example: [{"name": "John Smith", "email": "john@example.com", "phone": "555-1234"}, {"name": "Jane Doe"}]. If a field is not present or unreadable, omit it. If you cannot read a name clearly, include your best guess. Do not include any other text.',
            },
          ],
        },
      ],
      max_tokens: 4000,
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
    const parsed = JSON.parse(jsonMatch[0]) as unknown[];
    const entries: ScannedEntry[] = [];

    for (const item of parsed) {
      // Support both string format (legacy) and object format
      if (typeof item === 'string' && item.trim().length > 0) {
        entries.push({ name: item.trim() });
      } else if (item && typeof item === 'object' && 'name' in item) {
        const obj = item as { name?: string; email?: string; phone?: string };
        if (typeof obj.name === 'string' && obj.name.trim().length > 0) {
          entries.push({
            name: obj.name.trim(),
            email: typeof obj.email === 'string' && obj.email.trim() ? obj.email.trim() : null,
            phone: typeof obj.phone === 'string' && obj.phone.trim() ? obj.phone.trim() : null,
          });
        }
      }
    }

    return entries;
  } catch {
    console.error('Failed to parse OCR response:', content);
    return [];
  }
}

// ============================================================
// Fuzzy match parsed names against project people
// ============================================================

export interface MatchNameEntry {
  name: string;
  email?: string | null;
  phone?: string | null;
}

/**
 * Match parsed names against all people in a project using fuzzy matching.
 * Accepts either plain string names (legacy) or objects with name/email/phone.
 */
export async function matchParsedNames(
  names: (string | MatchNameEntry)[],
  projectId: string
): Promise<ParsedName[]> {
  const supabase = createServiceClient();

  // Load all people in the project
  const { data: people } = await supabase
    .from('people')
    .select('id, first_name, last_name, email, phone, mobile_phone')
    .eq('project_id', projectId)
    .is('deleted_at', null);

  // Normalize input to entries
  const entries: MatchNameEntry[] = names.map(n =>
    typeof n === 'string' ? { name: n } : n
  );

  if (!people || people.length === 0) {
    return entries.map((entry) => ({
      raw_text: entry.name,
      raw_email: entry.email ?? null,
      raw_phone: entry.phone ?? null,
      matched_person_id: null,
      match_confidence: 0,
      suggested_name: entry.name,
      match_status: 'unmatched' as const,
      new_email: false,
      new_phone: false,
    }));
  }

  // Index people by ID for quick lookup
  const peopleById = new Map(people.map(p => [p.id, p]));

  const results: ParsedName[] = [];

  for (const entry of entries) {
    let bestMatch: { personId: string; confidence: number; name: string } | null = null;

    for (const person of people) {
      const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ');
      if (!fullName && !person.email) continue;

      const nameParts = entry.name.trim().split(/\s+/);
      const result = scorePersonMatch(
        {
          first_name: nameParts[0] || null,
          last_name: nameParts.slice(1).join(' ') || null,
          email: entry.email ?? null,
          phone: entry.phone ?? null,
        },
        {
          first_name: person.first_name,
          last_name: person.last_name,
          email: person.email,
          phone: person.phone,
          mobile_phone: person.mobile_phone,
        }
      );

      if (!bestMatch || result.score > bestMatch.confidence) {
        bestMatch = { personId: person.id, confidence: result.score, name: fullName || person.email || '' };
      }
    }

    // Check if the scanned email/phone is new info for the matched person
    function detectNewInfo(personId: string | null) {
      if (!personId) return { newEmail: false, newPhone: false };
      const person = peopleById.get(personId);
      if (!person) return { newEmail: false, newPhone: false };

      const newEmail = !!(entry.email && !person.email);
      const newPhone = !!(entry.phone && !person.phone && !person.mobile_phone);

      return { newEmail, newPhone };
    }

    if (bestMatch && bestMatch.confidence > 0.85) {
      const { newEmail, newPhone } = detectNewInfo(bestMatch.personId);
      results.push({
        raw_text: entry.name,
        raw_email: entry.email ?? null,
        raw_phone: entry.phone ?? null,
        matched_person_id: bestMatch.personId,
        match_confidence: bestMatch.confidence,
        suggested_name: bestMatch.name,
        match_status: 'matched',
        new_email: newEmail,
        new_phone: newPhone,
      });
    } else if (bestMatch && bestMatch.confidence > 0.65) {
      const { newEmail, newPhone } = detectNewInfo(bestMatch.personId);
      results.push({
        raw_text: entry.name,
        raw_email: entry.email ?? null,
        raw_phone: entry.phone ?? null,
        matched_person_id: bestMatch.personId,
        match_confidence: bestMatch.confidence,
        suggested_name: bestMatch.name,
        match_status: 'possible',
        new_email: newEmail,
        new_phone: newPhone,
      });
    } else {
      results.push({
        raw_text: entry.name,
        raw_email: entry.email ?? null,
        raw_phone: entry.phone ?? null,
        matched_person_id: null,
        match_confidence: bestMatch?.confidence ?? 0,
        suggested_name: entry.name,
        match_status: 'unmatched',
        new_email: false,
        new_phone: false,
      });
    }
  }

  return results;
}
