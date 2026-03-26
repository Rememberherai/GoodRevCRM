import { useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useChatStore, type ChatMessage } from '@/stores/chat';

// Tool names that mutate data — trigger a page refresh after these complete
const MUTATING_TOOLS = new Set([
  'receipts.confirm',
  'receipts_confirm',
  'calendar.sync_program',
  'calendar_sync_program',
  'calendar.sync_job',
  'calendar_sync_job',
  'contractors.create_scope',
  'contractors_create_scope',
  'contractors.send_documents',
  'contractors_send_documents',
  'contractors.onboard',
  'contractors_onboard',
  'jobs.assign',
  'jobs_assign',
  'jobs.pull',
  'jobs_pull',
  'households.create',
  'households_create',
  'households.update',
  'households_update',
  'programs.create',
  'programs_create',
  'programs.update',
  'programs_update',
  'programs.enroll',
  'programs_enroll',
  'programs.record_attendance',
  'programs_record_attendance',
  'programs.add_waiver',
  'programs_add_waiver',
  'programs.remove_waiver',
  'programs_remove_waiver',
  'contributions.create',
  'contributions_create',
  'contributions.update',
  'contributions_update',
  'assets.create',
  'assets_create',
  'assets.update',
  'assets_update',
  'referrals.create',
  'referrals_create',
  'referrals.update',
  'referrals_update',
  'relationships.create',
  'relationships_create',
  'broadcasts.create',
  'broadcasts_create',
  'broadcasts.send',
  'broadcasts_send',
  'grants.create',
  'grants_create',
  'grants.update',
  'grants_update',
  'grants.update_document',
  'grants_update_document',
  'grants.create_report',
  'grants_create_report',
  'grants.update_report',
  'grants_update_report',
  'grants.import_federal',
  'grants_import_federal',
  'calendar.sync_grant',
  'calendar_sync_grant',
  'events.create', 'events_create',
  'events.update', 'events_update',
  'events.delete', 'events_delete',
  'events.publish', 'events_publish',
  'events.check_in', 'events_check_in',
  'events.cancel_registration', 'events_cancel_registration',
  'events.create_ticket_type', 'events_create_ticket_type',
  'events.create_series', 'events_create_series',
  'events.update_series', 'events_update_series',
  'events.confirm_attendance', 'events_confirm_attendance',
  'organizations_create', 'organizations_update', 'organizations_delete',
  'people_create', 'people_update', 'people_delete', 'people_link_organization',
  'opportunities_create', 'opportunities_update', 'opportunities_delete',
  'tasks_create', 'tasks_update', 'tasks_delete',
  'notes_create', 'notes_update', 'notes_delete',
  'tags_assign', 'tags_create',
  'sequences_create', 'sequences_update', 'sequences_delete',
  'sequences_enroll', 'sequences_unenroll',
  'rfps_create', 'rfps_update', 'rfps_delete',
  'meetings_create', 'meetings_update', 'meetings_delete',
  'email_send',
  'automations_create', 'automations_update', 'automations_delete',
  'content_create', 'content_update', 'content_delete',
  'news_create_keyword', 'news_delete_keyword', 'news_update_article',
  'schema_create', 'schema_update', 'schema_delete',
  'webhooks_create', 'webhooks_update', 'webhooks_delete',
  'reports_create', 'reports_delete',
  'reports_create_custom', 'reports_update_custom', 'reports_run',
  'templates_create', 'templates_update', 'templates_delete',
  'drafts_create', 'drafts_update', 'drafts_delete',
  'rfp_questions_create', 'rfp_questions_update', 'rfp_questions_delete',
  'widgets_create', 'widgets_update', 'widgets_delete',
  'members_update_role',
  'comments_create',
  'duplicates_resolve',
  'merge_execute',
  'enrichment_start',
  'contacts_add_to_org',
  'sms_send',
  'signatures_create', 'signatures_update', 'signatures_delete',
  'linkedin_generate_message',
  'bulk_execute',
  'sequence_steps_create', 'sequence_steps_update', 'sequence_steps_delete',
  'secrets_set', 'secrets_delete',
  'workflows_create', 'workflows_update', 'workflows_delete', 'workflows_activate', 'workflows_execute',
  'contracts_create', 'contracts_update', 'contracts_delete', 'contracts_void',
  'contracts_add_recipient', 'contracts_add_field',
  'products_create', 'products_update', 'products_delete',
  'quotes_create', 'quotes_update', 'quotes_delete', 'quotes_accept', 'quotes_reject', 'quotes_set_primary',
  'quotes_add_line_item', 'quotes_update_line_item', 'quotes_remove_line_item',
  'emails_create_contact_from_sender',
  'accounting_record_payment',
  'calendar_create_event_type', 'calendar_update_event_type', 'calendar_delete_event_type',
  'calendar_cancel_booking', 'calendar_update_profile', 'calendar_update_availability',
  'calendar_add_event_type_member', 'calendar_remove_event_type_member',
  'dispositions_create', 'dispositions_update', 'dispositions_delete',
  'service_types.create', 'service_types.update', 'service_types.delete',
  'service_types_create', 'service_types_update', 'service_types_delete',
  'bug_reports.update_status', 'bug_reports_update_status',
]);

function normalizeToolName(toolName: string) {
  return toolName.replace(/\./g, '_');
}

export interface PageContext {
  entityType: 'organization' | 'person';
  entityId: string;
}

function detectPageContext(pathname: string): PageContext | null {
  // Match /projects/[slug]/organizations/[uuid]
  const orgMatch = pathname.match(/\/projects\/[^/]+\/organizations\/([0-9a-f-]{36})/);
  if (orgMatch?.[1]) return { entityType: 'organization', entityId: orgMatch[1] };

  // Match /projects/[slug]/people/[uuid]
  const personMatch = pathname.match(/\/projects\/[^/]+\/people\/([0-9a-f-]{36})/);
  if (personMatch?.[1]) return { entityType: 'person', entityId: personMatch[1] };

  return null;
}

export function useChat(projectSlug: string) {
  // Subscribe to state for rendering
  const store = useChatStore();
  const abortRef = useRef<AbortController | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const hadMutationRef = useRef(false);

  // Extract stable action references (these never change between renders)
  const setConversations = useChatStore((s) => s.setConversations);
  const setCurrentConversation = useChatStore((s) => s.setCurrentConversation);
  const setCurrentConversationId = useChatStore((s) => s.setCurrentConversationId);
  const setMessages = useChatStore((s) => s.setMessages);
  const addMessage = useChatStore((s) => s.addMessage);
  const appendStreamingContent = useChatStore((s) => s.appendStreamingContent);
  const resetStreamingContent = useChatStore((s) => s.resetStreamingContent);
  const addToolCall = useChatStore((s) => s.addToolCall);
  const updateToolCallResult = useChatStore((s) => s.updateToolCallResult);
  const clearToolCalls = useChatStore((s) => s.clearToolCalls);
  const finalizeToolCalls = useChatStore((s) => s.finalizeToolCalls);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setError = useChatStore((s) => s.setError);
  const reset = useChatStore((s) => s.reset);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/chat`);
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      // Silently fail
    }
  }, [projectSlug, setConversations]);

  const loadConversation = useCallback(async (conversationId: string) => {
    setCurrentConversation(conversationId);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/chat?conversationId=${conversationId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      setError('Failed to load conversation');
    }
  }, [projectSlug, setCurrentConversation, setMessages, setError]);

  const sendMessage = useCallback(async (text: string) => {
    const state = useChatStore.getState();
    if (state.isStreaming) return;

    setError(null);
    setStreaming(true);
    resetStreamingContent();
    clearToolCalls();
    hadMutationRef.current = false;

    // Add user message optimistically
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    addMessage(userMsg);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const pageContext = detectPageContext(pathname);
      const res = await fetch(`/api/projects/${projectSlug}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: useChatStore.getState().currentConversationId,
          message: text,
          pageContext,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        setError(err.error ?? 'Request failed');
        setStreaming(false);
        return;
      }

      if (!res.body) {
        setError('No response body');
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);

            switch (event.type) {
              case 'conversation':
                if (!useChatStore.getState().currentConversationId && event.conversationId) {
                  setCurrentConversationId(event.conversationId);
                }
                break;

              case 'tool_call':
                addToolCall({
                  id: event.id,
                  name: event.name,
                  arguments: event.arguments,
                  status: 'pending',
                });
                if (MUTATING_TOOLS.has(event.name) || MUTATING_TOOLS.has(normalizeToolName(event.name))) {
                  hadMutationRef.current = true;
                }
                break;

              case 'tool_result':
                updateToolCallResult(
                  event.id,
                  event.result,
                  'complete'
                );
                break;

              case 'text_delta':
                appendStreamingContent(event.content);
                break;

              case 'done':
                // Finalize: move streaming content into a message
                {
                  const finalContent = useChatStore.getState().streamingContent;
                  if (finalContent) {
                    const assistantMsg: ChatMessage = {
                      id: `msg-${Date.now()}`,
                      role: 'assistant',
                      content: finalContent,
                      created_at: new Date().toISOString(),
                    };
                    addMessage(assistantMsg);
                    resetStreamingContent();
                  }
                }
                // Move pending tool calls to completed (persistent display)
                finalizeToolCalls();
                // Refresh conversations list for title updates
                loadConversations();
                // Hot-refresh the page if any mutating tools were used
                if (hadMutationRef.current) {
                  router.refresh();
                }
                break;

              case 'error':
                setError(event.message);
                break;
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    } finally {
      setStreaming(false);
      resetStreamingContent();
      abortRef.current = null;
    }
  }, [projectSlug, loadConversations, pathname, router, setError, setStreaming, resetStreamingContent, clearToolCalls, addMessage, setCurrentConversationId, addToolCall, updateToolCallResult, appendStreamingContent, finalizeToolCalls]);

  const newConversation = useCallback(() => {
    reset();
  }, [reset]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      await fetch(`/api/projects/${projectSlug}/chat/${conversationId}`, { method: 'DELETE' });
      const current = useChatStore.getState();
      setConversations(current.conversations.filter((c) => c.id !== conversationId));
      if (current.currentConversationId === conversationId) {
        reset();
      }
    } catch {
      // Silently fail
    }
  }, [projectSlug, setConversations, reset]);

  const renameConversation = useCallback(async (conversationId: string, title: string) => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/chat/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) return;
      const current = useChatStore.getState();
      setConversations(
        current.conversations.map((c) =>
          c.id === conversationId ? { ...c, title } : c
        )
      );
    } catch {
      // Silently fail
    }
  }, [projectSlug, setConversations]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    ...store,
    sendMessage,
    loadConversations,
    loadConversation,
    newConversation,
    deleteConversation,
    renameConversation,
    stopStreaming,
  };
}
