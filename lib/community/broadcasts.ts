import { createAdminClient } from '@/lib/supabase/admin';
import { sendOutboundSms } from '@/lib/telnyx/sms-service';
import { sendEmail } from '@/lib/gmail/service';
import type { Database, Json } from '@/types/database';
import type { GmailConnection } from '@/types/gmail';

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type BroadcastRow = Database['public']['Tables']['broadcasts']['Row'];
type GmailConnectionRow = Database['public']['Tables']['gmail_connections']['Row'];
type BroadcastRecipient = {
  person_id: string;
  household_id: string | null;
  email: string | null;
  mobile_phone: string | null;
  first_name: string | null;
  last_name: string | null;
};

type RecipientFilterCriteria = {
  person_ids?: string[];
  household_ids?: string[];
  program_ids?: string[];
};

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function resolveBroadcastRecipients(
  projectId: string,
  filterCriteria: Json | null
): Promise<BroadcastRecipient[]> {
  const admin = createAdminClient();
  const criteria = ((filterCriteria ?? {}) as RecipientFilterCriteria);
  const personRows: BroadcastRecipient[] = [];

  if (criteria.person_ids && criteria.person_ids.length > 0) {
    const { data } = await admin
      .from('people')
      .select('id, first_name, last_name, email, mobile_phone, household_members(household_id)')
      .eq('project_id', projectId)
      .in('id', criteria.person_ids)
      .is('deleted_at', null);

    for (const person of data ?? []) {
      const firstMembership = Array.isArray(person.household_members) ? person.household_members[0] : null;
      personRows.push({
        person_id: person.id,
        household_id: firstMembership?.household_id ?? null,
        email: person.email,
        mobile_phone: person.mobile_phone,
        first_name: person.first_name,
        last_name: person.last_name,
      });
    }
  }

  if (criteria.household_ids && criteria.household_ids.length > 0) {
    const { data } = await admin
      .from('household_members')
      .select('household_id, person:people(id, first_name, last_name, email, mobile_phone, deleted_at)')
      .in('household_id', criteria.household_ids);

    for (const row of data ?? []) {
      const person = Array.isArray(row.person) ? row.person[0] : row.person;
      if (!person || person.deleted_at) continue;
      personRows.push({
        person_id: person.id,
        household_id: row.household_id,
        email: person.email,
        mobile_phone: person.mobile_phone,
        first_name: person.first_name,
        last_name: person.last_name,
      });
    }
  }

  if (criteria.program_ids && criteria.program_ids.length > 0) {
    const { data } = await admin
      .from('program_enrollments')
      .select('household_id, person:people(id, first_name, last_name, email, mobile_phone, deleted_at)')
      .in('program_id', criteria.program_ids);

    for (const row of data ?? []) {
      const person = Array.isArray(row.person) ? row.person[0] : row.person;
      if (!person || person.deleted_at) continue;
      personRows.push({
        person_id: person.id,
        household_id: row.household_id,
        email: person.email,
        mobile_phone: person.mobile_phone,
        first_name: person.first_name,
        last_name: person.last_name,
      });
    }
  }

  return uniqueBy(personRows, (row) => row.person_id);
}

async function getProjectGmailConnection(projectId: string, userId: string): Promise<GmailConnectionRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('gmail_connections')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function sendBroadcast(
  broadcast: BroadcastRow,
  actorUserId: string
) {
  const recipients = await resolveBroadcastRecipients(broadcast.project_id, broadcast.filter_criteria);
  const gmailConnection = broadcast.channel === 'sms' ? null : await getProjectGmailConnection(broadcast.project_id, actorUserId);

  let sentCount = 0;
  const failures: string[] = [];

  for (const recipient of recipients) {
    const displayName = [recipient.first_name, recipient.last_name].filter(Boolean).join(' ').trim() || 'Community member';

    if (broadcast.channel === 'email' || broadcast.channel === 'both') {
      if (!gmailConnection || !recipient.email) {
        failures.push(`${displayName}: missing Gmail connection or email`);
      } else {
        try {
          await sendEmail(
            gmailConnection as unknown as GmailConnection,
            {
              to: recipient.email,
              subject: broadcast.subject,
              body_html: broadcast.body_html || `<p>${escapeHtml(broadcast.body).replace(/\n/g, '<br />')}</p>`,
              body_text: broadcast.body,
              person_id: recipient.person_id,
            },
            actorUserId,
            broadcast.project_id
          );
          sentCount += 1;
        } catch (error) {
          failures.push(`${displayName}: ${error instanceof Error ? error.message : 'Email failed'}`);
        }
      }
    }

    if (broadcast.channel === 'sms' || broadcast.channel === 'both') {
      if (!recipient.mobile_phone) {
        failures.push(`${displayName}: missing mobile phone`);
      } else {
        try {
          await sendOutboundSms({
            projectId: broadcast.project_id,
            userId: actorUserId,
            toNumber: recipient.mobile_phone,
            body: broadcast.body,
            personId: recipient.person_id,
          });
          sentCount += 1;
        } catch (error) {
          failures.push(`${displayName}: ${error instanceof Error ? error.message : 'SMS failed'}`);
        }
      }
    }
  }

  return {
    recipients,
    sentCount,
    failures,
  };
}
