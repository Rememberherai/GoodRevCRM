import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { McpContext } from '@/types/mcp';

export function registerEmailTools(server: McpServer, getContext: () => McpContext) {
  // emails.unknown_senders
  server.tool(
    'emails.unknown_senders',
    'List inbound emails from unknown senders at known organizations (domain-matched but no contact exists)',
    {
      organizationId: z.string().uuid().optional().describe('Filter by organization ID'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      let query = ctx.supabase
        .from('emails')
        .select('from_email, from_name, organization_id, email_date')
        .eq('project_id', ctx.projectId)
        .is('person_id', null)
        .not('organization_id', 'is', null)
        .eq('direction', 'inbound')
        .order('email_date', { ascending: false });

      if (params.organizationId) {
        query = query.eq('organization_id', params.organizationId);
      }

      const { data: emails, error } = await query;
      if (error) throw new Error(`Failed to fetch unknown senders: ${error.message}`);

      // Aggregate by sender
      const senderMap = new Map<string, {
        from_email: string;
        from_name: string;
        organization_id: string;
        email_count: number;
        latest_email_date: string;
      }>();

      for (const email of emails ?? []) {
        const key = `${email.from_email?.toLowerCase()}|${email.organization_id}`;
        const existing = senderMap.get(key);
        if (existing) {
          existing.email_count++;
          if (email.email_date > existing.latest_email_date) {
            existing.latest_email_date = email.email_date;
            if (email.from_name) existing.from_name = email.from_name;
          }
        } else {
          senderMap.set(key, {
            from_email: email.from_email?.toLowerCase() ?? '',
            from_name: email.from_name ?? '',
            organization_id: email.organization_id!,
            email_count: 1,
            latest_email_date: email.email_date,
          });
        }
      }

      const senders = [...senderMap.values()]
        .sort((a, b) => b.latest_email_date.localeCompare(a.latest_email_date))
        .slice(0, params.limit);

      // Enrich with org names
      const orgIds = [...new Set(senders.map(s => s.organization_id))];
      const orgMap = new Map<string, string>();
      if (orgIds.length > 0) {
        const { data: orgs } = await ctx.supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds);
        for (const org of orgs ?? []) orgMap.set(org.id, org.name);
      }

      const result = senders.map(s => ({
        ...s,
        organization_name: orgMap.get(s.organization_id) ?? 'Unknown',
      }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ senders: result, total: senderMap.size }),
        }],
      };
    }
  );

  // emails.create_contact_from_sender
  server.tool(
    'emails.create_contact_from_sender',
    'Create a CRM contact from an unknown email sender and link their historical emails',
    {
      from_email: z.string().email().describe('The sender email address'),
      organization_id: z.string().uuid().describe('The organization to link the contact to'),
      first_name: z.string().optional().describe('First name (auto-parsed from email header if omitted)'),
      last_name: z.string().optional().describe('Last name (auto-parsed from email header if omitted)'),
      job_title: z.string().optional().describe('Job title'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const normalizedEmail = params.from_email.toLowerCase().trim();
      let { first_name, last_name } = params;

      // Check for existing contact
      const { data: existing } = await ctx.supabase
        .from('people')
        .select('id')
        .ilike('email', normalizedEmail)
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      if (existing) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: 'Contact already exists', person_id: existing.id }),
          }],
        };
      }

      // Auto-parse name from email headers if not provided
      if (!first_name && !last_name) {
        const { data: recentEmail } = await ctx.supabase
          .from('emails')
          .select('from_name')
          .ilike('from_email', normalizedEmail)
          .eq('organization_id', params.organization_id)
          .eq('project_id', ctx.projectId)
          .not('from_name', 'is', null)
          .order('email_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recentEmail?.from_name) {
          const parts = recentEmail.from_name.trim().split(/\s+/);
          first_name = parts[0] ?? '';
          last_name = parts.slice(1).join(' ') || '';
        }
      }

      if (!first_name) {
        first_name = normalizedEmail.split('@')[0] ?? 'Unknown';
        last_name = last_name || '';
      }

      // Create person
      const { data: person, error: personError } = await ctx.supabase
        .from('people')
        .insert({
          first_name,
          last_name: last_name || '',
          email: normalizedEmail,
          job_title: params.job_title || null,
          project_id: ctx.projectId,
          created_by: ctx.userId,
        })
        .select()
        .single();

      if (personError) throw new Error(`Failed to create contact: ${personError.message}`);

      // Link to organization
      await ctx.supabase
        .from('person_organizations')
        .insert({
          person_id: person.id,
          organization_id: params.organization_id,
          project_id: ctx.projectId,
          is_primary: true,
          is_current: true,
        });

      // Backfill emails
      const { count } = await ctx.supabase
        .from('emails')
        .update({ person_id: person.id }, { count: 'exact' })
        .ilike('from_email', normalizedEmail)
        .eq('organization_id', params.organization_id)
        .eq('project_id', ctx.projectId)
        .is('person_id', null);

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'entity.created',
        entityType: 'person',
        entityId: person.id,
        data: {
          ...person,
          source: 'unknown_sender_mcp',
          emails_linked: count ?? 0,
        },
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ person, emails_linked: count ?? 0 }),
        }],
      };
    }
  );
}
